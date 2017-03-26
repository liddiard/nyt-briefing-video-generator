'use strict';

const request  = require('superagent');
const cheerio = require('cheerio');
const jsonfile = require('jsonfile');

request
.get('http://mobile.nytimes.com/2016/07/08/nytnow/your-friday-briefing-dallas-donald-trump-euro-2016.html')
.end((err, res) => {
  if (err) console.error(err);
  const $ = cheerio.load(res.text);

  let briefing = {
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

    const text = $(this).text();
    const currentLastBrief = briefing.briefs[briefing.briefs.length-1];

    // stop condition: don't parse briefs after Business section
    if (text === 'Business') {
      finished = true;
    }
    // new brief: paragraph starts with a bullet and contains bolded text
    else if (text.indexOf('•') === 0 && $(this).find('strong').length) {
      briefing.briefs.push({
        title: text.substr(2), // cut off the bullet and the space following it
        sentences: [],
        images: []
      });
    }
    // we haven't reached the first bullet yet; continue 
    else if (!briefing.briefs.length) {
    }
    // inline image
    else if ($(this).hasClass('span-image')) {
      currentLastBrief.images.push(
        $(this).find('img').attr('src')
      );
    }
    // regular text paragraph
    else {
      let sentences = text.split('. ');
      let links = desktopLinksToMobile($, $(this).find('a')); // links in this paragraph
      sentences.forEach(sentence => {
        currentLastBrief.sentences.push({
          text: sentence,
          media: [] // image or video URLs to be populated later
        });

        // go through each link in the paragraph and find its associated sentence 
        links.each(function(index, link) {
          const url = $(this).prop('href');
          // if the text of this link is found in this sentence and the link is an NYT link
          if (sentence.indexOf($(this).text()) > -1 && url.indexOf('mobile.nytimes.com') > -1) {
            getArticleMedia(url, 
                            currentLastBrief.sentences[currentLastBrief.sentences.length-1]);
          }
        });
      });
    }
  });
  setTimeout(() => { 
    jsonfile.writeFile('briefing.json', briefing, {spaces: 2}, err => {
      if (err) console.log(err);
    });
  }, 10000);
});

function getArticleMedia(url, sentence) {
  request
  .get(url)
  .end((err, res) => {
    if (err) {
      console.error('error on: ' + url);
      return;
    }
    const $ = cheerio.load(res.text);
    const leadPhoto = $('header .span-asset-img');
    const leadVideo = $('header .article-span-video-container');
    if (leadPhoto.length) {
      sentence.media.push({
        type: 'image',
        url: leadPhoto.find('img').data('lightbox-image-url')
      });
    }
    if (leadVideo.length) {
      getVideoUrl(leadVideo.data('video-id'), sentence);
    }
  });
}

function getVideoUrl(id, sentence) {
  request
  .get(`https://www.nytimes.com/svc/video/api/v3/video/${id}`)
  .end((err, res) => {
    if (err) console.error(err);
    sentence.media.push({
      type: 'video',
      url: res.body.renditions
    });
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