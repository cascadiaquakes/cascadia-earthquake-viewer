import aws_cdk as core
import aws_cdk.assertions as assertions

from eq_infra.eq_infra_stack import EqInfraStack

# example tests. To run these tests, uncomment this file along with the example
# resource in eq_infra/eq_infra_stack.py
def test_sqs_queue_created():
    app = core.App()
    stack = EqInfraStack(app, "eq-infra")
    template = assertions.Template.from_stack(stack)

#     template.has_resource_properties("AWS::SQS::Queue", {
#         "VisibilityTimeout": 300
#     })
