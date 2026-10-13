# Security

The editor serves its UI on `127.0.0.1` only, rejects requests whose `Host`/`Origin` is not local and requires a custom header on every state-changing request, so web pages you visit cannot drive your pedal. If you find a way around this, or any other vulnerability, please report it privately through GitHub's *Security → Report a vulnerability* instead of a public issue.
