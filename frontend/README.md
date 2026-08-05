# Frontend dashboard

A lightweight, dependency-free single-page dashboard for the deployed SAM API.

## Run locally

From the repository root, serve the project with any static-file server, for
example:

```powershell
python -m http.server 8080 --directory frontend
```

Open `http://localhost:8080`, paste the `ApiUrl` output from `sam deploy`, and
select **Save & load**. The URL must include the API Gateway stage path (for
example, `/dev`).

The frontend uses these API endpoints directly:

- `GET /events`
- `POST /register`
- `GET /registrations/{email}`
- `DELETE /registration/{id}`

The SAM template already enables CORS for these methods. For production, host
the `frontend` directory on a static site host such as Amazon S3/CloudFront or
GitHub Pages.
