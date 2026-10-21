import { buildForwardHeaderHtml } from "./mailCompose";

export const delay = (time: number) => new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), time)
);

// const originalHtml = `<p>---------- Forwarded message ---------</p><p>From: Alex</p><p>Date: Mon, Jun 9 2014 9:32 PM</p><p>Subject: Batteries </p><p>To: Jessica</p><p><br></p><p><br></p>`;


// export function updateMessageDetails(newFrom: string, newDateMillis: number, newTo: string) {
//     let htmlString = originalHtml
//     // Use Moment.js to format the date from milliseconds
//     const formattedDate = moment(newDateMillis).format('ddd, MMM D YYYY h:mm A');

//     // Replace the From, Date, and To fields in the HTML string
//     htmlString = htmlString.replace(/<p>From:.*?<\/p>/, `<p>From: ${newFrom}</p>`);
//     htmlString = htmlString.replace(/<p>Date:.*?<\/p>/, `<p>Date: ${formattedDate}</p>`);
//     htmlString = htmlString.replace(/<p>To:.*?<\/p>/, `<p>To: ${newTo}</p>`);

//     return htmlString;
// }

/**
 * The forwarded-message header. Every field is HTML-escaped (Bugs #16): a
 * subject such as `<script>` used to be interpolated straight into the editor.
 */
export function updateMessageDetails(newFrom: string, newSubject: string, newTo: string) {
    return buildForwardHeaderHtml({ from: newFrom, subject: newSubject, to: newTo });
}