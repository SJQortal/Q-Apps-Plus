import moment from "moment";

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

const originalHtml = `<p>---------- Forwarded message ---------</p><p>From: Alex</p><p>Subject: Batteries </p><p>To: Jessica</p><p><br></p><p><br></p>`;


export function updateMessageDetails(newFrom: string, newSubject: string, newTo: string) {
    let htmlString = originalHtml

    htmlString = htmlString.replace(/<p>From:.*?<\/p>/, `<p>From: ${newFrom}</p>`);
    htmlString = htmlString.replace(/<p>Subject:.*?<\/p>/, `<p>Subject: ${newSubject}</p>`);
    htmlString = htmlString.replace(/<p>To:.*?<\/p>/, `<p>To: ${newTo}</p>`);

    return htmlString;
}