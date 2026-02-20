from aws_cdk import (
    Stack,
    aws_ec2 as ec2,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_certificatemanager as acm,
    aws_cloudfront_origins as origins,
    aws_iam as iam,
    CfnOutput,
)
from constructs import Construct


class EarthquakeStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        # Import existing VPC
        vpc = ec2.Vpc.from_lookup(
            self,
            "ExistingVpc",
            vpc_id="vpc-0e7aacf72d6e093e7",
        )

        # Security group for backend EC2 instance
        backend_sg = ec2.SecurityGroup(
            self,
            "BackendSecurityGroup",
            vpc=vpc,
            description="Security group for backend Docker server",
            allow_all_outbound=True,
        )

        # Allow inbound traffic for Martin tile server (port 3000)
        backend_sg.add_ingress_rule(
            ec2.Peer.any_ipv4(),
            ec2.Port.tcp(3000),
            "Martin tile server"
        )

        # Allow inbound traffic for API server (port 3002)
        backend_sg.add_ingress_rule(
            ec2.Peer.any_ipv4(),
            ec2.Port.tcp(3002),
            "API server"
        )

        # IAM role for EC2 instance with SSM and ECR access
        backend_role = iam.Role(
            self,
            "BackendRole",
            assumed_by=iam.ServicePrincipal("ec2.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "AmazonSSMManagedInstanceCore"
                ),
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "AmazonEC2ContainerRegistryReadOnly"
                ),
            ],
        )

        # User data script to bootstrap EC2 instance
        user_data = ec2.UserData.for_linux()
        user_data.add_commands(
            "#!/bin/bash",
            "set -e",
            "exec > >(tee /var/log/user-data.log) 2>&1",

            # Install Docker and Git
            "yum update -y",
            "yum install -y docker git",
            "systemctl enable docker",
            "systemctl start docker",
            "usermod -aG docker ec2-user",

            # Install Docker Compose
            "curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose",
            "chmod +x /usr/local/bin/docker-compose",

            # Clone application repository
            "cd /home/ec2-user",
            "rm -rf cascadia-earthquake-viewer || true",
            "git clone https://github.com/cascadiaquakes/cascadia-earthquake-viewer.git",
            "chown -R ec2-user:ec2-user cascadia-earthquake-viewer",
            "cd cascadia-earthquake-viewer",

            # Start Docker Compose services using production compose
            "sudo -u ec2-user /usr/local/bin/docker-compose -f docker-compose.prod.yml up -d",

            # Log deployment completion
            "echo 'Deployment complete' > /home/ec2-user/deployment.log",
        )

        # EC2 instance for backend services
        backend_instance = ec2.Instance(
            self,
            "BackendInstance",
            vpc=vpc,
            instance_type=ec2.InstanceType.of(
                ec2.InstanceClass.BURSTABLE3,
                ec2.InstanceSize.LARGE,
            ),
            machine_image=ec2.MachineImage.latest_amazon_linux2023(),
            security_group=backend_sg,
            role=backend_role,
            user_data=user_data,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PUBLIC
            ),
            block_devices=[
                ec2.BlockDevice(
                    device_name="/dev/xvda",
                    volume=ec2.BlockDeviceVolume.ebs(
                        volume_size=50,
                        volume_type=ec2.EbsDeviceVolumeType.GP3,
                        delete_on_termination=True,
                    ),
                )
            ],
        )

        # Import existing S3 bucket for frontend hosting
        site_bucket = s3.Bucket.from_bucket_name(
            self,
            "ExistingReactBucket",
            "crescent-react-hosting",
        )

        # S3 origin for frontend static files
        s3_origin = origins.S3BucketOrigin.with_origin_access_control(
            site_bucket,
            origin_path="/earthquake-viewer",
        )

        # HTTP origin for Martin tile server (port 3000)
        martin_origin = origins.HttpOrigin(
            domain_name=backend_instance.instance_public_dns_name,
            protocol_policy=cloudfront.OriginProtocolPolicy.HTTP_ONLY,
            http_port=3000,
        )

        # HTTP origin for API server (port 3002)
        api_origin = origins.HttpOrigin(
            domain_name=backend_instance.instance_public_dns_name,
            protocol_policy=cloudfront.OriginProtocolPolicy.HTTP_ONLY,
            http_port=3002,
        )

        # CloudFront distribution
        distribution = cloudfront.Distribution(
            self,
            "EqDistribution",
            domain_names=["eqcat.cascadiaquakes.org"],
            certificate=acm.Certificate.from_certificate_arn(
                self,
                "EqCert",
                "arn:aws:acm:us-east-1:818214664804:certificate/7240596e-50ed-4c9f-bda5-491908c2583a"
            ),
            default_root_object="index.html",
            default_behavior=cloudfront.BehaviorOptions(
                origin=s3_origin,
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
            ),
            additional_behaviors={
                # Route tile requests to Martin server (port 3000)
                "/tiles_zxy/*": cloudfront.BehaviorOptions(
                    origin=martin_origin,
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,
                    origin_request_policy=cloudfront.OriginRequestPolicy.ALL_VIEWER,
                ),
                # Route API requests to API server (port 3002)
                "/api/*": cloudfront.BehaviorOptions(
                    origin=api_origin,
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
                    cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,
                    origin_request_policy=cloudfront.OriginRequestPolicy.ALL_VIEWER,
                ),
            },
        )

        # Stack outputs
        frontend_url = f"https://{distribution.distribution_domain_name}"

        CfnOutput(
            self,
            "FrontendURL",
            value=f"{frontend_url}/index.html",
            description="Earthquake Viewer"
        )

        CfnOutput(
            self,
            "TilesEndpoint",
            value=f"{frontend_url}/tiles_zxy/0/0/0.pbf",
            description="Test tile endpoint"
        )

        CfnOutput(
            self,
            "ApiEndpoint",
            value=f"{frontend_url}/api/catalogs",
            description="Test API endpoint"
        )

        CfnOutput(
            self,
            "BackendIP",
            value=backend_instance.instance_public_ip,
            description="Backend EC2 IP"
        )

        CfnOutput(
            self,
            "DebugCommand",
            value=f"aws ssm start-session --target {backend_instance.instance_id}",
            description="Connect to backend via SSM"
        )