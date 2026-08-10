# EventHub — Event Registration & Ticketing System

EventHub is a serverless event registration and ticketing application built on AWS. It provides a REST API and web dashboard for viewing available events, registering for an event, finding registrations by email address, and cancelling a registration.

**Architecture:** API Gateway → AWS Lambda (Python 3.12) → Amazon DynamoDB, with Amazon CloudWatch monitoring and alarms, optional SNS email notifications, and GitHub Actions CI/CD.

**AWS services and tools:** API Gateway, Lambda, DynamoDB, CloudWatch, IAM, optional SNS, AWS SAM, and GitHub Actions.

## Project description

EventHub consists of a dependency-free web dashboard in `frontend/` and a REST API defined in `template.yaml`. The dashboard sends HTTPS requests to API Gateway, which routes each request to its Lambda handler. The Lambda functions implement the application logic and store event and registration data in DynamoDB. CloudWatch captures Lambda logs and monitors the registration function’s error rate; GitHub Actions runs tests and deploys the SAM application. AWS SAM defines and deploys the serverless infrastructure.

## Live links

- **GitHub Repository:** [Event-ticketing-registration](https://github.com/dorahowusu20001-ux/Event-ticketing-registration)
- **Live Web Application:** https://dorahowusu20001-ux.github.io/Event-ticketing-registration/
- **Live API Gateway:** `https://zfxujvpipi.execute-api.us-west-1.amazonaws.com/dev`

---

## Project prerequisites

The following tools were used to build, test, and deploy EventHub.

| Tool | Purpose | Verify installation |
|---|---|---|
| [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) | Authenticates with and operates the AWS account | `aws --version` |
| [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) | Builds and deploys the serverless application | `sam --version` |
| Python 3.12 | Lambda runtime and local test runtime | `python3 --version` |

AWS CLI credentials can be configured for local deployments with:

```bash
aws configure
# AWS Access Key ID, Secret Access Key, region (for example, eu-west-1), output format (json)
```

---

## Project structure

```
event-registration-system/
├── template.yaml                 # SAM template: AWS resources and API routes
├── src/handlers/
│   ├── register.py               # POST /register
│   ├── list_events.py            # GET /events
│   ├── get_registrations.py      # GET /registrations/{email}
│   ├── cancel_registration.py    # DELETE /registration/{id}
│   └── utils/response.py         # shared JSON response and CORS helper
├── scripts/seed_events.py        # adds two sample events after deployment
├── tests/test_handlers.py        # unit tests using mocked AWS services
├── .github/workflows/deploy.yml  # API test and deployment workflow
├── .github/workflows/pages.yml   # frontend publishing workflow
├── frontend/                     # dependency-free web dashboard
├── docs/architecture.png         # implemented architecture diagram
└── README.md
```

## Architecture diagram

The diagram below reflects the deployed EventHub architecture and its request, data, monitoring, and delivery flows.

![EventHub architecture](docs/architecture.png)

## Web dashboard

The dependency-free dashboard in [frontend/](frontend/) is published through GitHub Pages and communicates directly with the API Gateway endpoint. It lets participants register, look up registrations by email, view attendee details and registration IDs, and cancel registrations.

To use the deployed dashboard, open the **Live Web Application** link above, enter the API Gateway URL, and select **Save & load**. To serve it locally:

```powershell
python -m http.server 8080 --directory frontend
```

Open `http://localhost:8080`. The API URL must include its stage path, such as `/dev`.

### GitHub Pages deployment

The [Pages workflow](.github/workflows/pages.yml) publishes `frontend/` when frontend files or the Pages workflow change on `main`; it can also be run manually. The repository’s Pages source must be set to **GitHub Actions**. Deployment status and the published URL are available from the **Actions** tab.

---

## Phase 1: Infrastructure Foundation

This phase defines EventHub’s AWS foundation in `template.yaml`.

- **API Gateway** is the public REST API entry point. It receives HTTP requests and routes them to the corresponding Lambda function.
- **Lambda** runs the Python 3.12 business logic only when an endpoint is invoked.
- **DynamoDB** stores event and registration records in two on-demand tables.
- **IAM** scopes each Lambda function’s access to the resources it needs.

### Database design

| Resource | Purpose | Key design |
|---|---|---|
| `EventsTable` | Stores the events available for registration. | Partition key: `eventId` (string). |
| `RegistrationsTable` | Stores submitted registrations and their status. | Partition key: `registrationId` (string). |
| `EmailIndex` | Finds registrations for one email address efficiently. | Global secondary index on `email`, with all attributes projected. |

`GET /registrations/{email}` queries `EmailIndex` rather than scanning the full registrations table. Both tables use `PAY_PER_REQUEST` billing, so capacity is managed automatically.

---

## Phase 2: API Development

The four API endpoints in the project brief are implemented in `src/handlers/`. Each handler returns JSON through the shared `utils/response.py` helper, including CORS headers for browser access.

| Endpoint | Purpose and Lambda behaviour | DynamoDB interaction | Expected result |
|---|---|---|---|
| `POST /register` | `register.py` validates the request body and email address, confirms the event exists, and creates a confirmed registration. | Reads `EventsTable`; writes a record to `RegistrationsTable`. | `201` with the new registration, or `400` for invalid input and `404` for an unknown event. |
| `GET /events` | `list_events.py` retrieves every available event and sorts the response by date. | Scans `EventsTable`, following DynamoDB pagination. | `200` with `events` and `count`. |
| `GET /registrations/{email}` | `get_registrations.py` URL-decodes and normalises the email before finding matching records. | Queries the `EmailIndex` on `RegistrationsTable`. | `200` with matching `registrations` and `count`; `400` when no email path value is supplied. |
| `DELETE /registration/{id}` | `cancel_registration.py` checks that a registration exists before deleting it. | Reads and then deletes from `RegistrationsTable`. | `200` confirming cancellation, `400` for a missing ID, or `404` when the registration does not exist. |

Unexpected DynamoDB failures in the list and registration-lookup handlers return `500` responses. The registration handler also publishes a confirmation message only when the optional SNS topic is configured.

### Build and deploy

The following commands are used to build and deploy EventHub from the project root:

```bash
sam build
sam deploy --guided
```

`--guided` records stack and region choices in `samconfig.toml`, allowing later deployments to use `sam deploy`. The deployment outputs include `ApiUrl`, `EventsTableName`, and `RegistrationsTableName`.

### Seed sample events

The repository includes a script that inserts two sample events after deployment:

```bash
# Replace events-dev with the EventsTableName output for the deployed stage.
python scripts/seed_events.py events-dev
```

### API examples

```bash
# List events
curl https://YOUR_API_URL/events

# Register
curl -X POST https://YOUR_API_URL/register \
  -H "Content-Type: application/json" \
  -d '{"eventId":"evt-001","email":"friend@example.com","name":"Kwame"}'

# View a person's registrations
curl https://YOUR_API_URL/registrations/friend@example.com

# Cancel (use the registrationId returned above)
curl -X DELETE https://YOUR_API_URL/registration/REGISTRATION_ID
```

---

## Phase 3: Automation & CI/CD

The [deployment workflow](.github/workflows/deploy.yml) implements this flow:

`GitHub → GitHub Actions → tests → AWS SAM build → AWS deployment`

- On pull requests to `main`, the `test` job checks out the code, installs Python 3.12 and the test dependencies, then runs `pytest tests/ -v`.
- On pushes to `main`, the same test job runs first. If it succeeds, the `deploy` job installs the AWS SAM CLI, configures AWS credentials from the `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` repository secrets, builds the application, and deploys the `event-registration-system-prod` stack.
- The production deployment uses `Stage=prod`, `CAPABILITY_IAM`, `--resolve-s3`, and non-interactive change-set options.

The unit tests use `moto` to mock DynamoDB, so the test job does not require a live AWS account.

---

## Phase 4: Monitoring & Security

EventHub configures the following operational and security-related controls in the SAM template.

- **CloudWatch Logs:** Lambda invocation logs are available under `/aws/lambda/<function-name>`. The template explicitly creates the register function’s log group (`/aws/lambda/event-register-<stage>`) with a 14-day retention period.
- **CloudWatch alarm:** `RegisterErrorRateAlarm` calculates `(Errors / Invocations) * 100` for `RegisterFunction` over five-minute periods. It enters alarm state when the configured project threshold of **5%** is exceeded for one evaluation period. Missing data is treated as not breaching.
- **Optional notifications:** Supplying `NotificationEmail` creates an SNS topic and email subscription. The register function can publish registration confirmations, and the error-rate alarm can send notifications to the same topic. Without this parameter, SNS resources are not created.
- **Input validation:** The registration handler rejects missing event IDs, malformed email addresses, and invalid JSON before writing data. Lookup and cancellation handlers also reject missing path parameters.
- **Least-privilege permissions:** Event listing and registration lookup receive DynamoDB read permissions; registration and cancellation receive permissions for the registration table as defined by their SAM policy templates. The registration function also has scoped `sns:Publish` permission for the optional notification topic.
- **CORS and API access:** API Gateway and the shared response helper allow `GET`, `POST`, `DELETE`, and `OPTIONS` requests with `Content-Type` and `Authorization` headers from any origin. This supports the hosted dashboard but should be narrowed to trusted origins for a more restricted deployment.

**AWS Budgets** are not defined by SAM in this repository. A budget can be added separately if required:

```bash
aws budgets create-budget --account-id YOUR_ACCOUNT_ID --budget file://budget.json
```

---

## Phase 5: Deployment and Optimization

EventHub is deployed through AWS SAM, with GitHub Actions automating the production deployment after successful tests.

- **Cost model:** Lambda, API Gateway, DynamoDB, and CloudWatch are serverless services. Costs depend on actual usage and applicable AWS Free Tier limits.
- **Log lifecycle:** The template configures 14-day retention for the register Lambda log group. Review retention for other automatically created Lambda log groups if the deployment requires a consistent policy across all functions.
- **Tearing down resources:** When the EventHub stack is no longer needed, it can be removed with:

  ```bash
  sam delete
  ```

  This removes the resources created by the selected SAM stack.

### Deliverables Checklist

- [x] GitHub repository with API code
- [x] CI/CD pipeline using GitHub Actions
- [x] Lambda functions
- [x] DynamoDB table definitions
- [x] CloudWatch alarms configuration
- [x] README documentation
- [ ] Product presentation — problem, challenges, and demo

---

## Running tests locally

The project’s handler tests can be run locally before deployment:

```bash
pip install -r tests/requirements-test.txt
pytest tests/ -v
```

The test suite covers successful registration, unknown-event rejection, invalid-email rejection, event listing, and the register → lookup → cancel → cancel-again (`404`) flow.

## Troubleshooting

- **`sam build` fails on imports** — run it from the repository root, where `template.yaml` is located.
- **403 or permission errors in Lambda logs** — review the relevant function’s `Policies:` entry in `template.yaml` and the AWS deployment credentials.
- **Browser CORS errors** — confirm that the frontend uses the exact `ApiUrl` deployment output, including the stage path such as `/dev` or `/prod`.
