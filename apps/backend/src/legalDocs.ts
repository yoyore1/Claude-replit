/**
 * Deterministic Privacy / Terms / Support content, tailored to one app.
 *
 * This is the SINGLE source of truth for the three "included documents":
 *  - the IDE shows them (GET /projects/:id/docs) before the app is built, and
 *  - the build renders them into real on-device screens (see buildShell.ts).
 *
 * No LLM is involved — the text is templated from the app name, what data the
 * app collects (its capabilities), and an editable support email — so every app
 * always ships complete, consistent, sensible docs.
 */

export interface DocSection {
  heading: string;
  body: string;
}
export interface Doc {
  title: string;
  sections: DocSection[];
}
export interface AppDocs {
  privacy: Doc;
  terms: Doc;
  support: Doc;
}

/** A safe, editable placeholder support address derived from the app name. */
export function supportEmailFor(appName: string): string {
  const slug =
    (appName || "app")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "app";
  return `support@${slug}.app`;
}

/** One plain-language bullet per capability, for the "what we collect" section. */
const CAPABILITY_DATA: Record<string, string> = {
  camera: "Photos or images you choose to take or upload while using the app.",
  location:
    "Your location, only while you are using a feature that needs it (for example, to show what is nearby).",
  notifications:
    "A device notification token, so the app can send the alerts and reminders you turn on.",
  motion: "Motion and activity readings from your device's sensors.",
  ai: "The content you send to in-app AI features, which is processed to generate a response.",
  internet:
    "The requests you make to third-party online services to fetch live information you ask for.",
  images: "The text prompts you provide when generating images.",
  voice:
    "Audio you record for voice input, which is converted to text on your behalf.",
  docs: "Documents you add to your personal in-app knowledge base.",
};

function collectionBullets(capabilities: string[]): string {
  const lines: string[] = [
    "• Information you create in the app (such as the items, entries, and settings you save). This stays on your device.",
  ];
  for (const cap of capabilities) {
    const line = CAPABILITY_DATA[cap];
    if (line) lines.push(`• ${line}`);
  }
  lines.push(
    "• Basic, anonymous diagnostics needed to keep the app running reliably.",
  );
  return lines.join("\n");
}

export function legalDocs(input: {
  appName: string;
  capabilities?: string[];
  supportEmail?: string;
  description?: string;
}): AppDocs {
  const appName = input.appName?.trim() || "this app";
  const caps = input.capabilities ?? [];
  const email = input.supportEmail || supportEmailFor(appName);
  const intro = input.description?.trim()
    ? `${appName} — ${input.description.trim()}`
    : appName;

  const privacy: Doc = {
    title: "Privacy Policy",
    sections: [
      {
        heading: "Overview",
        body: `This Privacy Policy explains how ${appName} handles your information. We built ${appName} to be useful without collecting more than it needs. By using ${appName}, you agree to the practices described here.`,
      },
      {
        heading: "Information we collect",
        body: collectionBullets(caps),
      },
      {
        heading: "How we use your information",
        body: `We use your information only to make ${appName} work for you — to save what you create, power the features you use, and keep the app stable. We do not sell your personal information, and we do not use it for advertising.`,
      },
      {
        heading: "Where your data lives",
        body: `The content you create is stored on your device. Some features may send data to trusted services to work (for example, an AI request or a live-data lookup), and that data is used only to fulfil your request.`,
      },
      {
        heading: "Your choices and rights",
        body: `You stay in control of your data. You can edit or remove the content you create at any time, and you can delete your account and all of its data from inside the app using the Delete Account option in Settings.`,
      },
      {
        heading: "Children's privacy",
        body: `${appName} is not directed at children under 13, and we do not knowingly collect personal information from them.`,
      },
      {
        heading: "Changes to this policy",
        body: `We may update this policy as ${appName} evolves. When we make a meaningful change, we will update the policy shown here.`,
      },
      {
        heading: "Contact us",
        body: `Questions about your privacy? Email us at ${email}.`,
      },
    ],
  };

  const terms: Doc = {
    title: "Terms of Service",
    sections: [
      {
        heading: "Acceptance of terms",
        body: `These Terms of Service govern your use of ${appName} (${intro}). By using the app, you agree to these terms.`,
      },
      {
        heading: "Using the app",
        body: `You may use ${appName} for your own personal or business purposes. Please use it lawfully and don't misuse it or interfere with how it works for others.`,
      },
      {
        heading: "Your content",
        body: `Anything you create in ${appName} belongs to you. You are responsible for the content you add and for keeping your own copies of anything important.`,
      },
      {
        heading: "Acceptable use",
        body: `Don't use ${appName} to break the law, infringe someone else's rights, or attempt to disrupt, reverse-engineer, or gain unauthorized access to the app or its services.`,
      },
      {
        heading: "Disclaimer",
        body: `${appName} is provided "as is," without warranties of any kind. We work to keep it dependable, but we can't guarantee it will always be available or error-free.`,
      },
      {
        heading: "Limitation of liability",
        body: `To the fullest extent allowed by law, ${appName} and its makers are not liable for any indirect or incidental damages arising from your use of the app.`,
      },
      {
        heading: "Changes to these terms",
        body: `We may update these terms from time to time. Continuing to use ${appName} after an update means you accept the revised terms.`,
      },
      {
        heading: "Contact us",
        body: `Questions about these terms? Email us at ${email}.`,
      },
    ],
  };

  const support: Doc = {
    title: "Support",
    sections: [
      {
        heading: "Getting help",
        body: `We're here to help you get the most out of ${appName}. Most questions are answered below — and if not, we're an email away.`,
      },
      {
        heading: "Frequently asked questions",
        body: `• How do I change my information? Open the relevant screen, tap what you want to change, and edit it directly.\n• Is my data backed up? Your content is stored on your device. Keep your own copies of anything important.\n• How do I delete my account? Go to Settings and tap Delete Account. This removes your account and data from this device.`,
      },
      {
        heading: "Troubleshooting",
        body: `If something isn't working, try closing and reopening ${appName} first. If the problem continues, email us with a short description of what happened and we'll help.`,
      },
      {
        heading: "Contact support",
        body: `Email us at ${email} and we'll get back to you as soon as we can.`,
      },
      {
        heading: "Feedback",
        body: `Have an idea to make ${appName} better? We'd love to hear it — send your thoughts to ${email}.`,
      },
    ],
  };

  return { privacy, terms, support };
}
