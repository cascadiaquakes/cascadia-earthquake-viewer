#!/usr/bin/env python3
import aws_cdk as cdk

from eq_infra.earthquake_stack import EarthquakeStack

app = cdk.App()

EarthquakeStack(
    app,
    "EarthquakeStack",
    env=cdk.Environment(
        account="818214664804",
        region="us-west-2"
    ),
)

app.synth()
