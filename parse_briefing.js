'use strict';

const request  = require('superagent');
const cheerio = require('cheerio');
const jsonfile = require('jsonfile');

request
.get('http://mobile.nytimes.com/2016/06/30/nytnow/your-thursday-briefing-istanbul-supreme-court-michael-phelps.html')
.end((err, res) => {
  if (err) console.error(err);
  const $ = cheerio.load(res.text);

  let document = {
    headline: $('.headline').text(),
    byline: $('#byline').text(),
    date: Date($('.dateline')),
    briefs: []
  };
  
  const paragraphs = $('.article-body .p-block');

  let finished = false;
  // using `function` keyword below to prevent arrow function `this` binding
  // behavior which doesn't work with cheerio
  paragraphs.each(function(index, paragraph) {
    if (finished) return;

    let text = $(this).text(); 
    let isImage = $(this).hasClass('span-image');

    // stop condition
    if (text === 'Business') {
      finished = true;
    }
    // brief title
    else if (text.indexOf('•') === 0) {
      document.briefs.push({
        title: text.substr(2),
        sentences: [],
        images: []
      });
    }
    // we haven't reached the first bullet yet; continue 
    else if (!document.briefs.length) {
    }
    // inline image
    else if (isImage) {
      document.briefs[document.briefs.length-1].images.push(
        $(this).find('img').attr('src')
      );
    }
    // regular text paragraph
    else {
      let sentences = text.split('. ');
      sentences = sentences.forEach(sentence => {
        document.briefs[document.briefs.length-1].sentences.push(sentence);
      });
      getImagesFromLinks($, $(this), 
                         document.briefs[document.briefs.length-1].images);
    }
  });
  setTimeout(() => { 
    jsonfile.writeFile('briefing.json', document, {spaces: 2}, err => {
      if (err) console.log(err);
    });
  }, 5000);
});

function getImagesFromLinks($, paragraph, briefImages) {
  let links = desktopLinksToMobile($, paragraph.find('a'));
  links.each(function(index, link) {
    const url = $(this).prop('href');
    if (url.indexOf('mobile.nytimes.com') > -1) {
      request
      .get(url)
      .end((err, res) => {
        if (err) {
          console.error('error on: ' + url);
          return;
        }
        const $$ = cheerio.load(res.text);
        const leadPhoto = $$('.span-image')
        if (leadPhoto) {
          briefImages.push(leadPhoto.find('img').data('lightbox-image-url'));
        }
      });
    }
  });
}

function desktopLinksToMobile($, links) {
  return links.map(function(index, link) {
    if ($(this).prop('href').indexOf('www.nytimes.com') < 0) return;
    const href = $(this).prop('href').replace('www.nytimes.com', 'mobile.nytimes.com');
    $(this).prop('href', href);
    return $(this);
  });
}