/**
 * The first-run tour, loaded lazily (Bundle §5.3): react-joyride and its
 * floating-ui closure only reach a browser that has not dismissed the tour
 * yet (localStorage `tourStatus-qmail`).
 */
import { Joyride, ACTIONS, STATUS, type Step } from "react-joyride";

export const TOUR_STATUS_STORAGE_KEY = "tourStatus-qmail";
export const TOUR_STATUS_DISMISSED = "dismissed";

const steps: Step[] = [
  {
    content: (
      <div>
        <h2>Welcome To Q-Mail</h2>
        <p style={{ fontSize: "1.125rem" }}>Let's take a tour</p>
        <p style={{ fontSize: "0.75rem" }}>
          The Qortal community, along with its development team and the creators
          of this application, cannot be held accountable for any content
          published or displayed. Furthermore, they bear no responsibility for
          any data loss that may occur as a result of using this application.
        </p>
      </div>
    ),
    placement: "center",
    target: ".step-1",
  },
  {
    target: "[data-qapp-lib-sidebar-item='inbox']",
    content: (
      <div>
        <h2>Changing instances</h2>
        <p style={{ fontSize: "1.125rem" }}>
          Toggle between your main inbox, aliases, and groups you've joined.
        </p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "[data-qapp-lib-sidebar-item='compose']",
    content: (
      <div>
        <h2>Composing a mail message</h2>
        <p style={{ fontSize: "1.125rem", fontWeight: "bold" }}>
          Compose a secure message featuring encrypted attachments (up to 40MB
          per attachment).
        </p>
        <p style={{ fontSize: "1.125rem" }}>
          To protect the identity of the recipient, assign them an alias for
          added anonymity.
        </p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "[data-qapp-lib-sidebar-item='aliases']",
    content: (
      <div>
        <h2>What is an alias?</h2>
        <p style={{ fontSize: "1.125rem", fontWeight: "bold" }}>
          To conceal the identity of the message recipient, utilize the alias
          option when sending.
        </p>
        <p style={{ fontSize: "0.875rem" }}>
          For instance, instruct your friend to address the message to you using
          the alias 'FrederickGreat'.
        </p>
        <p style={{ fontSize: "0.875rem" }}>
          To access messages sent to that alias, simply add the alias as an
          instance.
        </p>
      </div>
    ),
    placement: "bottom",
  },
];

interface MailTourProps {
  run: boolean;
  onDone: () => void;
}

export function MailTour({ run, onDone }: MailTourProps) {
  return (
    <Joyride
      steps={steps}
      run={run}
      onEvent={(data: any) => {
        const { action, status } = data;
        if (
          status === STATUS.FINISHED ||
          status === STATUS.SKIPPED ||
          action === ACTIONS.SKIP
        ) {
          onDone();
        }
      }}
      continuous={true}
      scrollToFirstStep={true}
      options={{ showProgress: true }}
    />
  );
}
