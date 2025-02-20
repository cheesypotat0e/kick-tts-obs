import { Clerk } from "@clerk/clerk-js";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const redirectUrl = import.meta.env.VITE_REDIRECT_URL;

if (!clerkPubKey) {
  throw new Error("Missing Clerk Publishable Key");
}

// Initialize loading state
document.getElementById("app")!.innerHTML = `
  <div class="loading">
    <div class="spinner"></div>
    <p>Loading...</p>
  </div>
`;

const clerk = new Clerk(clerkPubKey);

clerk.addListener(async ({ user }) => {
  if (user) {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("user_id");

    if (!userId) {
      return;
    }

    const token = await clerk.session?.getToken();
    const response = await fetch(`${redirectUrl}?user_id=${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const code = data.code;

      document.getElementById("app")!.innerHTML = `
      <div class="container">
        <div class="code">
          <h2>Your Authentication Code</h2>
          <pre>${code}</pre>
          <p>Use this code to authenticate your application</p>
        </div>
        </div>
      `;
    } else {
      console.error("Failed to get auth code");
    }
  } else {
    console.error("Failed to get auth code");
  }
});

try {
  await clerk.load();

  if (clerk.user) {
    document.getElementById("app")!.innerHTML = `
      <div class="container">
        <h1>Welcome back!</h1>
        <p>Redirecting to dashboard...</p>
        <div id="user-button"></div>
      </div>
    `;

    const userButtonDiv = document.getElementById("user-button")!;
    clerk.mountUserButton(userButtonDiv as HTMLDivElement);

    const token = await clerk.session?.getToken();
    const params = new URLSearchParams(window.location.search);
    const user_id = params.get("user_id");
    const response = await fetch(`${redirectUrl}?user_id=${user_id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const code = data.code;

      document.getElementById("app")!.innerHTML = `
        <div class="container">
          <div class="code">
            <h2>Your Authentication Code</h2>
            <pre>${code}</pre>
            <p>Use this code to authenticate your application</p>
          </div>
        </div>
      `;
    } else {
      console.error("Failed to get auth code");
    }
  } else {
    document.getElementById("app")!.innerHTML = `
      <div class="container">
        <h1>Welcome</h1>
        <p>Please sign in or create an account to continue</p>
        <div id="sign-in"></div>
      </div>
    `;

    const signInDiv = document.getElementById("sign-in")!;
    clerk.mountSignIn(signInDiv as HTMLDivElement);
  }
} catch (error) {
  console.error("Error initializing Clerk:", error);
  document.getElementById("app")!.innerHTML = `
    <div class="error">
      <h1>Something went wrong</h1>
      <p>Unable to initialize authentication. Please try again later.</p>
    </div>
  `;
}
