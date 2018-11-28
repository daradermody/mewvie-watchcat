const axios = require('axios');
const fs = require('fs');
const Emailer = require('./emailing/index');
const _ = require('lodash');

const MOVIE_FILE = __dirname + '/movies.json';


function extractData(resp) {
  eval(resp.data);
  return { cinemalist, filmByCounty, filmByCinema, filmlist };
}


function getMoviesAndCinemas(data) {
  // Index 12 is the county ID attributed to Galway. You can determine your own county by looking at the response
  const galwayCinemas = data.cinemalist[12].filter(cinema => cinema[0].includes('Galway'));

  const cinemasAndMovies = {};
  galwayCinemas.forEach(cinema => {
    const cinemaName = cinema[0].replace(', Galway', '').replace(' Galway', '').replace(/�/g, 'á');
    cinemasAndMovies[cinemaName] = data.filmByCinema[cinema[1]].map(movieId => data.filmlist[movieId]);
  });

  return swap(cinemasAndMovies);
}


function swap(obj) {
  const reverseObj = {};
  for (const key in obj) {
    for (const value of obj[key]) {
      if (!reverseObj[value]) {
        reverseObj[value] = [];
      }
      reverseObj[value].push(key);
    }
  }
  return reverseObj;
}


function checkForNewMovies(moviesAndCinemas) {
  const currentMovies = Object.keys(moviesAndCinemas);

  const savedMovies = JSON.parse(fs.readFileSync(MOVIE_FILE, 'utf-8'));
  const newMovies = currentMovies.filter(movie => !savedMovies.includes(movie));

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


if (!fs.existsSync(MOVIE_FILE)) {
  fs.writeFileSync(MOVIE_FILE, '[]');
}

axios.get('http://entertainment.ie/ssi/lib/cinema-search.js')
  .then(extractData)
  .then(getMoviesAndCinemas)
  .then(checkForNewMovies)
  .then(movies => fs.writeFileSync(MOVIE_FILE, JSON.stringify(movies, null, 2)))
  .catch(err => Emailer.sendMail(
    'daradermody@gmail.com',
    'Error checking for new movies',
    'error.pug',
    { error: err.message }
  ));
