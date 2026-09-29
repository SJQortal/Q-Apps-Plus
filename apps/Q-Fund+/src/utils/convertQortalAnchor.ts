export function convertQortalLinks(inputHtml) {
    // Regular expression to match 'qortal://...' URLs. 
    // This will stop at the first whitespace, comma, or HTML tag
    var regex = /(qortal:\/\/[^\s,<]+)/g;

    // Replace matches in inputHtml with formatted anchor tag
    var outputHtml = inputHtml.replace(regex, function (match) {
        return `<a href="${match}" className="qortal-link">${match}</a>`;
    });

    return outputHtml;
}