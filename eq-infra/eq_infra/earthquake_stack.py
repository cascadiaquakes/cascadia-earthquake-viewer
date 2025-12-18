from aws_cdk import (
    Stack,
    RemovalPolicy,
    aws_ec2 as ec2,
    aws_rds as rds,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_s3_deployment as s3_deployment,
    aws_secretsmanager as secretsmanager,
    CfnOutput,
)
from constructs import Construct


class EarthquakeStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        # Import VPC
        vpc = ec2.Vpc.from_lookup(
            self, "ExistingVpc",
            vpc_id="vpc-0e7aacf72d6e093e7"
        )

        # RDS Postgres
        db_secret = secretsmanager.Secret(
            self, "EqDbSecret",
            description="Earthquake Postgres credentials",
            generate_secret_string=secretsmanager.SecretStringGenerator(
                secret_string_template='{"username":"postgres"}',
                generate_string_key="password",
                exclude_punctuation=True,
            ),
        )

        db_sg = ec2.SecurityGroup(
            self, "EqDbSecurityGroup",
            vpc=vpc,
            description="Earthquake Postgres access",
            allow_all_outbound=True,
        )

        eq_db = rds.DatabaseInstance(
            self, "EqPostgres",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.VER_14
            ),
            vpc=vpc,
            credentials=rds.Credentials.from_secret(db_secret),
            allocated_storage=40,
            max_allocated_storage=200,
            multi_az=False,
            deletion_protection=False,
            removal_policy=RemovalPolicy.DESTROY,
            database_name="eq_catalog",
            instance_type=ec2.InstanceType.of(
                ec2.InstanceClass.BURSTABLE3,
                ec2.InstanceSize.SMALL,
            ),
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
            ),
            security_groups=[db_sg],
        )

        # Import S3 bucket
        site_bucket = s3.Bucket.from_bucket_name(
            self, "ExistingReactBucket",
            "crescent-react-hosting"
        )

        # CloudFront Distribution
        distribution = cloudfront.Distribution(
            self, "EqDistribution",
            default_root_object="index.html",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(
                    site_bucket,
                    origin_path="/earthquake-viewer"
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            ),
        )

        # Deploy files to S3
        s3_deployment.BucketDeployment(
            self, "DeployEqViewer",
            sources=[s3_deployment.Source.asset("../frontend/dist")],
            destination_bucket=site_bucket,
            destination_key_prefix="earthquake-viewer",
            distribution=distribution,
            distribution_paths=["/*"],
        )

        # Outputs
        CfnOutput(self, "URL",
            value=f"https://{distribution.distribution_domain_name}",
            description="Earthquake Viewer URL"
        )