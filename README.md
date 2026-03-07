This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

This repository hosts a Next.js application that implements an advanced, mobile‑friendly
quiz about the Fall of Constantinople (Άλωση της Κωνσταντινούπολης).

### Local development

```bash
npm install        # install dependencies
npm run dev        # start the development server
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The home page
links to `/quiz` where the interactive multiple‑choice test lives.

### Quiz features

- 10 questions with one correct answer each (Greek text).
- Client‑side state management, shuffling of questions.
- Progress bar, score calculation and restart button.
- ErrorBoundary component catches rendering failures.
- Optional integration with Firebase/Firestore to persist scores (see below).
- Responsive design, suitable for phones – just open the URL on a mobile device.
- Styled using Tailwind CSS with an "historic" colour theme.



Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Environment variables (optional)

If you want to store quiz results in Firestore, create a Firebase project and
add the following to your environment (e.g. in `.env.local`):

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

The application is written so that it still works without any of these values;
results are logged to the console instead.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

1. Connect your GitHub repository in the Vercel dashboard.
2. Set the environment variables (if using Firebase) under **Settings > Environment Variables**.
3. Choose `main` as the production branch.

Every push to `main` will trigger a build and deploy the latest version.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
