const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const puppeteer = require('puppeteer');

(async () => {
    const htmlContent = fs.readFileSync('/Users/dany/Documents/so-active_sommerkarte/index.html', 'utf8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    const sections = Array.from(document.querySelectorAll('.tab-section'));
    
    let denseHtml = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Menu PDF</title>
    <style>
        @page {
            size: A4;
            margin: 10mm;
        }
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 8px;
            margin: 0;
            padding: 0;
            column-count: 3;
            column-gap: 15px;
            color: #222;
        }
        h1 {
            text-align: center;
            font-size: 16px;
            margin: 0 0 15px 0;
            column-span: all;
            color: #78350f;
            font-family: serif;
        }
        h2.section-title {
            font-size: 12px;
            margin: 15px 0 8px 0;
            color: #92400e;
            text-transform: uppercase;
            font-weight: bold;
            border-bottom: 2px solid #92400e;
            padding-bottom: 2px;
            break-after: avoid;
            background-color: #fde68a;
            padding: 4px;
            border-radius: 2px;
        }
        .category {
            break-inside: avoid;
            margin-bottom: 12px;
        }
        .category-title {
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 6px;
            border-bottom: 1px solid #78350f;
            text-transform: uppercase;
            color: #78350f;
            padding-bottom: 2px;
        }
        .item {
            margin-bottom: 8px;
            break-inside: avoid;
        }
        .item-header {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 9px;
            align-items: flex-end;
        }
        .item-name {
            flex: 1;
            padding-right: 4px;
        }
        .item-price {
            white-space: nowrap;
        }
        .item-desc {
            font-size: 7px;
            color: #555;
            margin-top: 2px;
            line-height: 1.2;
        }
    </style>
</head>
<body>
    <h1>Sommerkarte 2026</h1>
`;

    sections.forEach(section => {
        const ariaLabel = section.getAttribute('aria-label');
        if (ariaLabel) {
            denseHtml += `<h2 class="section-title">${ariaLabel}</h2>`;
        }

        const subHeads = section.querySelectorAll('.sub-head');
        let currentSubHeadIndex = 0;
        
        let subHeadElements = Array.from(section.querySelectorAll('.sub-head, .menu-card'));

        let currentCategoryTitle = "";
        
        subHeadElements.forEach(el => {
            if (el.classList.contains('sub-head')) {
                const label = el.querySelector('.sub-head__label');
                currentCategoryTitle = label ? label.textContent.trim() : "Andere";
            } else if (el.classList.contains('menu-card')) {
                denseHtml += `<div class="category">`;
                denseHtml += `<div class="category-title">${currentCategoryTitle || "Menü"}</div>`;
                
                // Sometimes portions are used instead of normal price, or chips are embedded.
                // We handle standard menu-item here.
                const items = el.querySelectorAll('.menu-item');
                
                if (items.length > 0) {
                    items.forEach(item => {
                        const nameEl = item.querySelector('.item__name');
                        const descEl = item.querySelector('.item__desc');
                        const priceEl = item.querySelector('.item__price');

                        let name = nameEl ? nameEl.textContent.replace(/\s+/g, ' ').trim() : '';
                        let desc = descEl ? descEl.textContent.replace(/\s+/g, ' ').trim() : '';
                        let price = priceEl ? priceEl.textContent.replace(/\s+/g, ' ').trim() : '';
                        
                        if (nameEl && nameEl.querySelector('small')) {
                            let smallText = nameEl.querySelector('small').textContent;
                            name = name.replace(smallText, '').trim();
                            desc = smallText.trim() + (desc ? ', ' + desc : '');
                        }

                        if (priceEl && priceEl.querySelector('small')) {
                            let smallTexts = Array.from(priceEl.querySelectorAll('small')).map(s => s.textContent);
                            let combinedSmall = smallTexts.join(' / ');
                            let textWithoutSmall = priceEl.childNodes[0].nodeValue || priceEl.textContent;
                            textWithoutSmall = textWithoutSmall.trim();
                            
                            price = textWithoutSmall;
                            if(smallTexts.length > 0) {
                                price += ' | ' + combinedSmall;
                            }
                        }

                        // if price is missing, maybe it's in a portions list right below?
                        // portions are siblings to menu-item if it's the whole menu card
                        
                        denseHtml += `<div class="item">`;
                        denseHtml += `<div class="item-header"><span class="item-name">${name}</span><span class="item-price">${price}</span></div>`;
                        if (desc) {
                            denseHtml += `<div class="item-desc">${desc}</div>`;
                        }
                        denseHtml += `</div>`;
                    });
                } else {
                    // It could be lunch-card, etc., let's dump text
                    denseHtml += `<div class="item"><div class="item-desc">${el.textContent.replace(/\\s+/g, ' ').trim()}</div></div>`;
                }
                
                // What about portions inside this menu-card?
                const portions = el.querySelector('.portions');
                if (portions) {
                   const chips = Array.from(portions.querySelectorAll('.portion-chip'));
                   chips.forEach(chip => {
                       const strong = chip.querySelector('strong');
                       let price = strong ? strong.textContent.trim() : '';
                       let name = chip.textContent.replace(price, '').trim();
                       denseHtml += `<div class="item">`;
                       denseHtml += `<div class="item-header"><span class="item-name">${name}</span><span class="item-price">${price}</span></div>`;
                       denseHtml += `</div>`;
                   });
                }
                
                denseHtml += `</div>`;
            }
        });
    });

    denseHtml += `
</body>
</html>
`;

    fs.writeFileSync('/Users/dany/Documents/so-active_sommerkarte/dense_menu.html', denseHtml);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(denseHtml, { waitUntil: 'networkidle0' });
    await page.pdf({
        path: '/Users/dany/Documents/so-active_sommerkarte/menu.pdf',
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        margin: {
            top: '10mm',
            bottom: '10mm',
            left: '10mm',
            right: '10mm'
        }
    });

    await browser.close();
    console.log("PDF generated at menu.pdf");
})();
