<a href="https://www.makecomics.io/">
  <img alt="Make Comics" src="./public/og.png">
  <h1 align="center">Make Comics</h1>
</a>

<p align="center">
  Create comic books with AI. Generate stories, characters, and panels using advanced AI models.
</p>

## How AI Generates Comics

We use [**Google Flash Image 2.5**](https://www.together.ai/models/gemini-flash-image-2-5) to generate comic pages and [**Qwen3 80B**](https://www.together.ai/models/qwen3-next-80b-a3b-instruct) to generate story titles and narratives. 
The AI references previous pages for visual coherence and uses uploaded character images to maintain consistency across panels.

## Tech stack

- [Next.js 16](https://nextjs.org/) with React 19 and Tailwind CSS
- [Drizzle ORM](https://orm.drizzle.team/) with [Neon](https://neon.tech) PostgreSQL database
- [Clerk](https://clerk.com/) for authentication
- [Together AI](https://togetherai.link/?utm_source=make-comics&utm_medium=referral&utm_campaign=example-app) for LLM and image generation (Google Flash Image 2.5 and Qwen3 80B)
- [AWS S3](https://aws.amazon.com/s3/) for image storage
- [Upstash Redis](https://upstash.com/) for rate limiting
- [jsPDF](https://github.com/parallax/jsPDF) for PDF generation

## Cloning & running

1. Clone the repo: `git clone https://github.com/nutlope/make-comics`
2. Create a `.env` file based on `.example.env` and add your API keys:
   - **Together AI API key**: `TOGETHER_API_KEY=<your_together_ai_api_key>`
   - **AWS S3 credentials**: `S3_UPLOAD_KEY`, `S3_UPLOAD_SECRET`, `S3_UPLOAD_BUCKET`, `S3_UPLOAD_REGION`
   - **Database URL**: Use [Neon](https://neon.tech) to set up your PostgreSQL database: `DATABASE_URL=<your_database_url>`
   - **Clerk keys**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
   - **Upstash Redis**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
3. Run `npm install` and `npm run dev` to install dependencies and run locally
