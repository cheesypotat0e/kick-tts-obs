import "./styles/login.css";

const oauthUrl = import.meta.env.VITE_OAUTH_URL;
const authUrl = import.meta.env.VITE_AUTH_URL;

if (!oauthUrl || !authUrl) {
  throw new Error("Missing OAuth or Auth URL");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mainClientUrl = window.location.href.split("?")[0].replace("/login", "");

const getCookie = (name: string) => {
  document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="))
    ?.split("=")[1];
};

const params = new URLSearchParams(window.location.search);
const code =
  params.get("code") ??
  localStorage.getItem("auth_code") ??
  getCookie("auth_code");
const name =
  params.get("name") ?? localStorage.getItem("name") ?? getCookie("name");

if (!code) {
  document.getElementById("app")!.innerHTML = `
  <div class="container">
    <h1>Welcome</h1>
    <p>You are being redirected to the Kick OAuth login page</p>
    <img src="https://dev.kick.com/wp-content/uploads/2025/02/gifhero.gif" id="spinner" alt="Kick spinner" />
  </div>
`;

  await sleep(2000);

  window.location.href = `${oauthUrl}/`;

  while (true) {
    await sleep(10000);
  }
}

document.getElementById("app")!.innerHTML = `
  <div class="container">
    <h2>${name} this is your OBS Scene URL</h2>
    <div class="warning-container">
      <strong>⚠️ DO NOT SHOW THIS ON STREAM ⚠️</strong>
    </div>
    <div class="code-container-container" style="margin-top: 20px;">
      <div class="code-container-container-reveal">
        <div class="code-container hidden">
          ${mainClientUrl}?code=${code}
        </div>
        <div class="code-container-container-reveal-button">
          Reveal
        </div>
      </div>
      <div class="copy-indicator" style="font-size: 12px; margin-top: 4px; opacity: 0.8;">
        Click to copy
      </div>
    </div>
  </div>
`;

document
  .querySelector(".code-container")!
  .addEventListener("click", (event) => {
    const element = event.target as HTMLElement;
    const url = element.textContent;
    if (url) {
      navigator.clipboard.writeText(url);

      // Add click animation
      element.style.transform = "scale(0.95)";
      element.style.transition = "transform 0.1s, background-color 0.1s";
      element.style.backgroundColor = "#444444";

      setTimeout(() => {
        element.style.transform = "scale(1)";
        element.style.backgroundColor = "#222222";
      }, 100);

      const copyIndicator: HTMLElement =
        document.querySelector(".copy-indicator")!;
      copyIndicator.innerHTML = "Copied!";
      copyIndicator.style.color = "#FFFFFF";
      copyIndicator.style.opacity = "1";
      copyIndicator.style.transition = "opacity 0.1s";
      copyIndicator.style.transition = "color 0.1s";

      setTimeout(() => {
        copyIndicator.innerHTML = "Click to copy";
      }, 1000);
    }
  });

document
  .querySelector(".code-container-container-reveal-button")!
  .addEventListener("click", (event) => {
    const element = event.target as HTMLElement;

    document.querySelector(".code-container")!.classList.toggle("hidden");
    const text = element.textContent!.trim();
    element.textContent = text === "Reveal" ? "Hide" : "Reveal";
  });

// if (!clerkPubKey) {
//   throw new Error("Missing Clerk Publishable Key");
// }

// // Initialize loading state
// document.getElementById("app")!.innerHTML = `
//   <div class="loading">
//     <div class="spinner"></div>
//     <p>Loading...</p>
//   </div>
// `;

// const clerk = new Clerk(clerkPubKey);

// const getAuthCode = async () => {
//   const params = new URLSearchParams(window.location.search);
//   let userId = params.get("user_id");

//   if (!userId) {
//     // Prompt user for ID if not provided in URL and wait for submission
//     userId = await new Promise<string>((resolve) => {
//       document.getElementById("app")!.innerHTML = `
//         <div class="container">
//           <h2>Enter User ID</h2>
//           <input type="text" id="user-id-input" placeholder="Enter your User ID">
//           <button id="submit-user-id">Continue</button>
//         </div>
//       `;

//       document
//         .getElementById("submit-user-id")!
//         .addEventListener("click", () => {
//           const input = document.getElementById(
//             "user-id-input"
//           ) as HTMLInputElement;
//           resolve(input.value);
//           input.disabled = true;
//         });
//     });
//   }

//   const token = await clerk.session?.getToken();
//   const response = await fetch(`${authUrl}/code?user_id=${userId}`, {
//     headers: {
//       Authorization: `Bearer ${token}`,
//     },
//   });

//   if (response.ok) {
//     const data = await response.json();
//     const code = data.code;

//     document.getElementById("app")!.innerHTML = `
//       <div class="container">
//         <div class="code">
//           <h2>Your Authentication Code</h2>
//           <pre>${code}</pre>
//           <p>Use the command <code>!code ${code}</code> to authenticate your Cheesy Bot</p>
//         </div>
//       </div>
//     `;
//   } else {
//     console.error("Failed to get auth code");
//   }
// };

// clerk.addListener(async ({ user }) => {
//   if (user) {
//     await getAuthCode();
//   } else {
//     console.error("Failed to get auth code");
//   }
// });

// try {
//   await clerk.load({
//     signInForceRedirectUrl: window.location.href,
//     signUpForceRedirectUrl: window.location.href,
//   });

//   if (clerk.user) {
//     await getAuthCode();
//   } else {
//     document.getElementById("app")!.innerHTML = `
//       <div class="container">
//         <h1>Welcome</h1>
//         <p>Please sign in or create an account to continue</p>
//         <div id="sign-in"></div>
//       </div>
//     `;

//     const signInDiv = document.getElementById("sign-in")!;
//     clerk.mountSignIn(signInDiv as HTMLDivElement);
//   }
// } catch (error) {
//   console.error("Error initializing Clerk:", error);
//   document.getElementById("app")!.innerHTML = `
//     <div class="error">
//       <h1>Something went wrong</h1>
//       <p>Unable to initialize authentication. Please try again later.</p>
//     </div>
//   `;
// }
