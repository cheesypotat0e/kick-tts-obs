import { Clerk } from "@clerk/clerk-js";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const authUrl = import.meta.env.VITE_AUTH_URL;

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

const getAuthCode = async () => {
  const params = new URLSearchParams(window.location.search);
  let userId = params.get("user_id");

  if (!userId) {
    // Prompt user for ID if not provided in URL and wait for submission
    await new Promise<string>((resolve) => {
      document.getElementById("app")!.innerHTML = `
        <div class="container">
          <h2>Enter User ID</h2>
          <input type="text" id="user-id-input" placeholder="Enter your User ID">
          <button id="submit-user-id">Continue</button>
        </div>
      `;

      document
        .getElementById("submit-user-id")!
        .addEventListener("click", () => {
          const input = document.getElementById(
            "user-id-input"
          ) as HTMLInputElement;
          resolve(input.value);
          input.disabled = true;
        });
    });
  }

  const token = await clerk.session?.getToken();
  const response = await fetch(`${authUrl}/code?user_id=${userId}`, {
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
          <p>Use the command <code>!code ${code}</code> to authenticate your Cheesy Bot</p>
        </div>
      </div>
    `;
  } else {
    console.error("Failed to get auth code");
  }
};

clerk.addListener(async ({ user }) => {
  if (user) {
    await getAuthCode();
  } else {
    console.error("Failed to get auth code");
  }
});

try {
  await clerk.load({
    signInForceRedirectUrl: window.location.href,
    signUpForceRedirectUrl: window.location.href,
  });

  if (clerk.user) {
    await getAuthCode();
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
