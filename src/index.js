const axios = require('axios');
const fs = require('fs');
const Emailer = require('./emailing/index');
const _ = require('lodash');
const { JSDOM } = require('jsdom');

const MOVIE_FILE = __dirname + '/movies.json';


function main() {
  if (!fs.existsSync(MOVIE_FILE)) {
    fs.writeFileSync(MOVIE_FILE, '[]');
  }

  axios.get(' https://entertainment.ie/cinema/cinema-listings/galway/eye-cinema-galway/')
    .then(extractData)
    .then(checkForNewMovies)
    .then(movies => fs.writeFileSync(MOVIE_FILE, JSON.stringify(movies, null, 2)))
    .catch(err => Emailer.sendMail(
      'daradermody@gmail.com',
      'Error checking for new movies',
      'error.pug',
      { error: err.message }
    ));
}


function extractData(resp) {
  const dom = new JSDOM(resp.data);
  const attributes = dom.window.document.getElementsByTagName('cinema-filter')[0].attributes;
  const cinemas = JSON.parse(Object.values(attributes).find(attr => attr.name === ':venues').value);
  const galwayCinemas = cinemas.filter(cinema => cinema.county === 'Galway' && cinema.name !== 'IMC Oranmore');

  const movies = {};
  galwayCinemas.forEach(cinema => {
    cinema.movies.forEach(movie => {
      movies[movie.title] = (movies[movie.title] || []).concat(cinema.name);
    });
  });

  return movies;
}


async function checkForNewMovies(moviesAndCinemas) {
  const currentMovies = Object.keys(moviesAndCinemas);

  const savedMovies = JSON.parse(fs.readFileSync(MOVIE_FILE, 'utf-8'));
  const newMovies = currentMovies.filter(movie => !savedMovies.includes(movie));

  moviesAndCinemas = await enrichWithLinks(moviesAndCinemas);

  if (newMovies.length) {
    Emailer.sendMail(
      'daradermody@gmail.com',
      'New movies are out!',
      'new-movies.pug',
      { movies: _.pick(moviesAndCinemas, newMovies) }
    )
      .catch(console.error);
  }

  return currentMovies;
}


async function enrichWithLinks(moviesAndCinemas) {
  const links = await Promise.all([
    getPalasLinks(),
    getEyeLinks(),
    getImcLinks()
  ]);

  const moviesAndCinemasWithLinks = {};
  _.forEach(moviesAndCinemas, (cinemas, movie) => {
    moviesAndCinemasWithLinks[movie] = cinemas.map(cinema => {
      if (cinema === 'Pálás') {
        return {
          name: cinema,
          link: getValueForKeySubstring(movie, links[0])
        };
      } else if (cinema === 'Eye Cinema, Galway') {
        return {
          name: 'Eye',
          link: getValueForKeySubstring(movie, links[1])
        };
      } else if (cinema === 'IMC Galway') {
        return {
          name: 'IMC',
          link: getValueForKeySubstring(movie, links[2])
        };
      } else {
        return {
          name: cinema,
          link: ''
        };
        return cinema;
      }
    });
  });
  return moviesAndCinemasWithLinks;
}


function getPalasLinks() {
  //TODO: JSDOM.fromURL
  return axios.get('https://palas.ie/')
    .then(resp => {
      const dom = new JSDOM(resp.data);
      const movieOptions = dom.window.document.getElementById('first-choice').children;
      return _.fromPairs(
        Object.values(movieOptions)
          .filter(movie => movie.textContent !== 'Choose a Showing')
          .map(movie => [movie.textContent, `https://palas.ie/showing/showing-${movie.attributes[0].value}`])
      );
    });
}


function getEyeLinks() {
  return axios.get('https://www.eyecinema.ie/')
    .then(resp => {
      const dom = new JSDOM(resp.data);
      const links = dom.window.document.getElementsByTagName('a');

      return _.fromPairs(
        Object.values(links)
          .filter(link => link.attributes.href.value.startsWith('/movie/') && link.attributes.title.value.startsWith('View '))
          .map(link => [link.attributes.title.value.substring(5), `https://www.eyecinema.ie${link.attributes.href.value}`])
      );
    });
}


function getImcLinks() {
  return axios.post(' https://www.imccinemas.ie/DesktopModules/Inventise.IMC.API/V1/API/Search/GetEventsByVenueDescription', { description: 'Galway' })
    .then(resp => _.fromPairs(resp.data.data.map(movie => [movie.Description, `https://www.imccinemas.ie/Event-Details/Galway/${movie.UrlLink}`])));
}


function getValueForKeySubstring(key, object) {
  const entry = Object.entries(object).find(([k, _]) => k.includes(key));
  if (entry) {
    return entry[1];
  } else {
    console.error(`Could not find ${key} amonst ${Object.keys(object)}`);
  }
}


main();
