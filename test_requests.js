const http = require('http');
http.get('http://localhost:3001/api/daily-todos', res => {
  console.log(res.statusCode);
});
