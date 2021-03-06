const execFile = require('child_process').execFile;

var votingSkip = 0;
var maxId = 0;
var voters = {};
var songIsVoted = {};

const globalMessage = function(msg) {
    console.log("Sending " + msg + " to all the clients");
    global.wsServer.connections.forEach(function(conn) {
      conn.sendUTF(msg);
    })
}

var getInfoSongs = function(connection) {
    connection.process = execFile('mpsyt', ['//'+global.song, ', 1'], (error, stdout, stderr) => {
      if (error) {
        throw error;
      }
      console.log("Get info spawned");
      console.log(stdout);
    });

    connection.process.stdout.on('data', function (data) {
      var cleanData = data.substr(data.indexOf("Num"));
      cleanData = cleanData.substr(0, cleanData.indexOf("Showing"));
      globalMessage(cleanData);
      connection.process.kill();
    });

    connection.process.stdout.on('error', function(data) {
        connection.sendUTF(data);
    });
}

const resetVoters = function() {
  votingSkip = 0;
  Object.keys(voters).forEach(function(key) {
    voters[key].voted = false;
  });
}

const killChild = function() {
  if (global.child) child.kill();
}

const startChild = function() {
  global.child = execFile('mpsyt', ['//'+global.song, ', 1, 1-'], (error, stdout, stderr) => {
    if (error) {
      throw error;
    }
    console.log(stdout);
  });
  // child.stdout.on('data', function (data) {
  //   if (maxInfoSong > 0) {
  //     infoSongs += data;
  //     --maxInfoSong;
  //   }
  // });
}

const changeSong = function(song, connection) {
  killChild();
  global.song = song;
  startChild();
  globalMessage("Song was changed by majoritysysmsg");
  getInfoSongs(connection);
}

exports.onRequest = function(request) {
	var connection = request.accept('', request.origin);
  console.log("Connected");
  getInfoSongs(connection);
  var myId = maxId;
  ++maxId;
  voters[myId] = {};
  voters[myId].voted = false;
  connection.on('message', function(message) {
      if (message.type === 'utf8') {
          console.log(message.utf8Data);
          if (message.utf8Data == 'skip') {
            if (!voters[myId].voted) {
              voters[myId].voted = true;
              ++votingSkip;
              if (parseFloat(votingSkip/global.wsServer.connections.length) > 0.70) {
                global.child.stdin.write(">");
                globalMessage("The people don't want to listen this song. Skipping.sysmsg");
                resetVoters();
              } else {
                globalMessage(votingSkip + " out of " + global.wsServer.connections.length + " persons are voting to skipsysmsg");
              }
            } else {
              connection.sendUTF("You already votedsysmsg");
              console.log("You already voted");
            }
          } else if (message.utf8Data.indexOf("newsong") > 0) {
              var songName = message.utf8Data.substr(0, message.utf8Data.indexOf("newsong"));
              if (!voters[myId][songName]) {
                voters[myId][songName] = true;
                songIsVoted[songName]++;
                globalMessage(songIsVoted[songName] + " out of " + global.wsServer.connections.length + " people voted for " + songName);
                console.log(songIsVoted[songName] + " out of " + global.wsServer.connections.length + " people voted for " + songName);
                if (parseFloat(songIsVoted[songName]/global.wsServer.connections.length) > 0.70) {
                  voters[myId][songName] = false;
                  songIsVoted[songName] = 0;
                  changeSong(songName, connection);
                }
              }
          } else {
            if (global.wsServer.connections.length == 1) changeSong(message.utf8Data, connection);
            else {
              console.log("created votation for new playlist");
              voters[myId][message.utf8Data] = false;
              songIsVoted[message.utf8Data] = 0;
              globalMessage(message.utf8Data+"newsong");
            }
          }
      }
  });
}
