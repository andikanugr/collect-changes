# Collect Changes Action

This action will collect changes from release and post it into slack channel.

## Inputs

## `service`

**Required** The name of services.

## `exclude`

**Required** The github user that excluded.

## `slack_channel`

**Required** The slack channel

## Environtment
* **GITHUB_REPOSITORY**
* **SLACK_BOT_TOKEN**
* **SLACK_BOT_SECRET**
* **GOOGLE_SHEET_ID**
* **GOOGLE_ACCOUNT_KEY**

## Example usage

>uses: andikanugr/collect-changes@v1.x\
with:\
  &ensp;&ensp;&ensp;&ensp;&ensp;service: 'serviceA'\
  &ensp;&ensp;&ensp;&ensp;&ensp;exclude: 'userA'\
  &ensp;&ensp;&ensp;&ensp;&ensp;slack_channel: 'my-channel'


