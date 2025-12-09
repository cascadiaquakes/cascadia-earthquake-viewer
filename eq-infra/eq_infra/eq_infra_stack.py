from aws_cdk import (
    # Duration,
    Stack,
    # aws_sqs as sqs,
)
from constructs import Construct

class EqInfraStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # our code that defines the stack goes here later

        # eg laterr resource
        # queue = sqs.Queue(
        #     self, "EqInfraQueue",
        #     visibility_timeout=Duration.seconds(300),
        # )
