export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_URL;

  const config = {
    "accountAssociation": {
    "header": "eyJmaWQiOjM1MDkxMSwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDJGREVmM0Y0NzBlQ2QyQmM5YTk3NzU2OEM0M0FEMzg2MGMxNjExRDgifQ",
    "payload": "eyJkb21haW4iOiJyZXdhcmQud3RmIn0",
    "signature": "MHhiM2E4YjcxOGNjODI4M2NkNmEyYTk0NmM2NGEzNjE2MWQ3YmEyMDZkZDBlNzZmYjNhZWRkOWRmNTg3ZDRjMTY2N2U0YzA5MzlmNzk0Y2MwZjEyOWI1NjI0YjJiMzY0MTAxZmQyY2NjOWY1Y2JhMTAzM2EwYTJlMjI3MDI2NzJjZDFj"
  },
    frame: {
      version: "0.0.0",
      name: "reward.wtf",
      iconUrl: `${appUrl}/icon-transparent.png`,
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#000000",
      homeUrl: appUrl,
      webhookUrl: `${appUrl}/api/webhook`,
    },
  };

  return Response.json(config);
}
