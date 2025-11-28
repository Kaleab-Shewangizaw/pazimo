# Deploying Pazimo Frontend to cPanel

Since your Next.js application uses dynamic routes (SSR), it requires a **Node.js** environment. You cannot simply upload it to the `public_html` folder like a static site.

## Prerequisites

1.  **cPanel with "Setup Node.js App"**: Your hosting provider must support Node.js.
2.  **SSH Access (Optional but recommended)**: For easier file management.

## Step 1: Configure & Build

I have already updated your `next.config.ts` to use `output: "standalone"`. This creates a lightweight build optimized for deployment.

1.  Run the build command locally:

    ```bash
    npm run build
    ```

2.  Run the preparation script I created to package everything:
    ```bash
    chmod +x prepare-deploy.sh
    ./prepare-deploy.sh
    ```
    This will create a `deploy-package.zip` file in your `frontend` folder.

## Step 2: cPanel Setup

1.  Log in to **cPanel**.
2.  Find and click on **Setup Node.js App**.
3.  Click **Create Application**.
    - **Node.js Version**: Select **v18** or **v20** (Next.js 15 requires Node.js 18.17+).
    - **Application Mode**: `Production`.
    - **Application Root**: `pazimo-frontend` (or any name you prefer).
    - **Application URL**: Select your domain.
    - **Application Startup File**: `server.js`.
4.  Click **Create**.

## Step 3: Upload Files

1.  Go to **File Manager** in cPanel.
2.  Navigate to the folder you created (e.g., `pazimo-frontend`).
3.  **Upload** the `deploy-package.zip` file.
4.  **Extract** the zip file inside this folder.
    - _Note: Ensure the files are directly in the folder, not inside a subfolder._

## Step 4: Install Dependencies & Start

1.  Back in the **Setup Node.js App** page:
    - Click **Run NPM Install**.
      - _Note: The standalone build includes most dependencies, but this ensures native modules are correct for the server's OS._
2.  Click **Restart Application**.

## Troubleshooting

- **500 Error**: Check the `stderr.log` in the application folder.
- **"Internal Server Error"**: Ensure the Node.js version is compatible (v18+).
- **Images not loading**: Ensure the `public` folder was copied correctly (the script does this).

## Environment Variables

Don't forget to add your environment variables in the cPanel Node.js App settings (or create a `.env` file in the app root):

- `NEXT_PUBLIC_API_URL`: URL of your backend (e.g., `https://api.yourdomain.com`)
- `NEXT_PUBLIC_SOCKET_URL`: URL for socket connection
