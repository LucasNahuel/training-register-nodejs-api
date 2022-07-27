const { MongoClient, ObjectId } = require("mongodb");
const username = encodeURIComponent("lucas");
const password = encodeURIComponent("can_317");
const clusterUrl = "cluster0.ypdud.mongodb.net";
const authMechanism = "DEFAULT";

var jwt = require('jsonwebtoken');

var cors = require('cors');

var bodyParser = require('body-parser');

const JWTtokenSecret = "LucasMunozJWT";

let db;

let userCollection;

let trainingOfUserCollection;

let trainingCollection;

let exerciseCollection;

let trainingDayCollection;

let exerciseDayCollection;

let exerciseSetCollection;

let trainingLogCollection;

let setLogCollection;

let trainingRatingCollection;


const uri =
  `mongodb+srv://${username}:${password}@${clusterUrl}/?authMechanism=${authMechanism}`;
// Create a new MongoClient
const client = new MongoClient(uri);

client.connect( (err, client) =>{
  if (err) return console.error(err)
  console.log('Connected to Database')
  db = client.db('training-db')
  userCollection = db.collection('user')
  trainingOfUserCollection = db.collection('trainingOfUsers');
  trainingCollection = db.collection('training');
  exerciseCollection = db.collection('exercise');
  trainingDayCollection = db.collection('trainingDay');
  exerciseDayCollection = db.collection('exerciseDay');
  exerciseSetCollection = db.collection('exerciseSet');
  trainingLogCollection = db.collection('trainingLog');
  setLogCollection = db.collection('setLog');
  trainingRatingCollection = db.collection('trainingRating');
});


const express = require('express');
const app = express();
const port = 3000;

app.use(cors());

app.use(bodyParser());


app.get('/', (req, res) => {
  res.send("Hello world!")
});


app.post('/register', (req, resPost) => {
  userCollection.insertOne(req.body)
      .then(res => {
          resPost.end("{\"value\":\"Changes saved\"}");
      })
      .catch(error => {resPost.status(500).send("unexpected error")})
});


app.post('/login', (req, resPost) => {

  const { user, password } = req.body;


  userCollection.findOne({ User: user }).then(

    userRes => {



      if( userRes && (userRes.password === password)){
        const token = "Bearer "+ jwt.sign({ sub : userRes.User, exp: Math.floor(Date.now() / 1000) + (60 * 60) }, JWTtokenSecret , {algorithm: 'HS512'});

        console.log(token);
          
        resPost.status(200).send({ value: token});
      }else{
        resPost.status(401).json({ "value" : "invalid credentials" });
      }



    },

    error=> {
      console.log(error);
    }



  );


  
});



app.get("/getUserByName/:userName", (req, resGet) =>{

  let user = null;

  console.log(req.params);

  userCollection.findOne({ User : req.params.userName }).then( res => {

    user = res;

    resGet.status(200).send(user);

  })

  

});







//request handler for checking the jwt

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
      const token = authHeader.split(' ')[2];

      console.log(token);

      jwt.verify(token, JWTtokenSecret, (err, user) => {
          if (err) {
              console.log(err);
              return res.sendStatus(403);
          }

          req.user = user;
          next();
      });
  } else {
      res.sendStatus(401);
  }
};





app.get("/getTraining", authenticateJWT, (req, res) => {

  async function getTrainingFunction() {

    const user  = req.query.user;

    const date = new Date(Number.parseInt(req.query.date.split("-")[2]),  Number.parseInt(req.query.date.split("-")[1])-1, Number.parseInt(req.query.date.split("-")[0]));



    //find the user id

    const userId = await userCollection.findOne({ User: user }).then(res => { return res});





    //get the trainings of users 

    const touCursor = await trainingOfUserCollection.find({ user : userId._id, isActive: "true" });




    class trainingLogResponse {

      trainingName
      creatorName
      exercises

    }

    class setResponse {

      dayName
      setId
      reps
      weight
      repsLogged
      weightLogged
    }

    class exerciseResponse{

      exerciseName
      sets //array


    }

    let tlrList = [];



    //iterate troughout the trainings of the user to find the exercises

    while(await touCursor.hasNext().then(res => { return res; }) == true){


      let tou = await touCursor.next().then(res => { return res });


      let actualTraining = await trainingCollection.findOne({ _id : tou.training }).then(res => { return res });

      let tlr = new trainingLogResponse();

      tlr.trainingName = actualTraining.name;
      tlr.exercises = new Array();

      let exercisesOfTrainingCursor = await exerciseCollection.find({trainingFk : tou.training});



      while(await exercisesOfTrainingCursor.hasNext() == true){

        actualExercise = await exercisesOfTrainingCursor.next().then(res => { return res });


        let elr = new exerciseResponse();

        elr.exerciseName = actualExercise.name;

        elr.sets = new Array();

        day = await trainingDayCollection.findOne({ day : date.toLocaleString('en-us', {weekday:'long'}).toLowerCase()}).then(res => { return res });

        exerciseDayCursor = await exerciseDayCollection.find({ exerciseFk: actualExercise._id, trainingDayFk: day._id });


        while(await exerciseDayCursor.hasNext() == true){

          console.log("exerciseDayCursor has next");

          let actualExerciseDay = await exerciseDayCursor.next();


          exerciseSetCursor = await exerciseSetCollection.find({ exerciseDayFk: actualExerciseDay._id });

          while( await exerciseSetCursor.hasNext() == true){

            
            let actualSet = await exerciseSetCursor.next().then(res => { return res });

            let set = new setResponse();
            set.setId = actualSet._id;
            set.reps = actualSet.repetitions;
            set.weight = actualSet.weight;

            let trainLogCursor = await trainingLogCollection.find( { userFK : userId._id });

            let matchingDayTrainLog = new Array();

            while ( await trainLogCursor.hasNext()   == true){

              

              let actualTrainLog = await  trainLogCursor.next();


              if (Number.parseInt(actualTrainLog.date.split("-")[0]) == date.getDate() && Number.parseInt(actualTrainLog.date.split("-")[1]) == date.getMonth()+1 && Number.parseInt(actualTrainLog.date.split("-")[2]) == date.getFullYear() ){


                matchingDayTrainLog.push(actualTrainLog);

              }

            }

            if(matchingDayTrainLog.length > 0){


              let mtl = matchingDayTrainLog[0];



              let setLogCursor = await setLogCollection.find({ trainingLogFK : mtl._id, setFK : actualSet._id });

              if(await setLogCursor.hasNext() == true){


                matchingSetLog = await setLogCursor.next();

                set.repsLogged = matchingSetLog.repetitionsDone;
                set.weightLogged = matchingSetLog.weightUsed;

              }

            }

            elr.sets.push(set);

          }

          if( elr != null ){
            tlr.exercises.push(elr);
          }

        }


      }


      if(tlr.exercises.length > 0){
        tlrList.push(tlr);
      }
      


    }

    res.status(200).json(tlrList);

  }

  getTrainingFunction();

});
















app.post("/createTraining", authenticateJWT, (req, resPost) =>{

  async function handler(){

  const {userCreatorName, trainingName} = req.body;
  const JSONexerciceList = JSON.parse(req.body.JSONexerciceList);

  let user = null;



  await userCollection.findOne({ User : userCreatorName }).then(res =>{
    user = res;
    }
  );


  //check if the user already have created a training with the same name

  await trainingCollection.findOne({ creatorFK : user._id, name : trainingName }).then(trainingRes => {

    if(trainingRes){
      res.status(401).send("{ \"message\" : \"you've already created a training with that name\"");
    } 

  });

  //create the training 

  class training {

    name
    creatorFK

  }

  let t = new training();

  t.creatorFK = user._id;
  t.name = trainingName;

  let insertedTrainingId = null;

  await trainingCollection.insertOne(t).then(res =>{


    insertedTrainingId = res.insertedId;

  }).catch(err => {
    console.log("error creating training: "+ err);
    resPost.status(500).send("error creating training");
  });





  //relate training with the user in the training-of-users collection


  class trainingOfUser{

    user
    training
    isActive

  }


  let tou = new trainingOfUser;

  tou.user = user._id;
  tou.training = insertedTrainingId;
  tou.isActive = "true";


  let insertedTouId;

  await trainingOfUserCollection.insertOne(tou).then(res =>{
    if(res.insertedOne) insertedTouId = res.insertedId;
  }).catch(err => {
    console.log("cant create training-of-user: "+ err);
    resPost.status(500).send("error creating training-of-user");
  });

  //iterate trough the array of exercises

  class exercise{

    name
    trainingFk

  }

  class exerciseDay{

    exerciseFk
    trainingDayFk

  }

  class exerciseSet{

    exerciseDayFk
    repetitions
    weight

  }

  for( var i = 0; i < JSONexerciceList.length; i++){


    //create the exercise

    let e = new exercise();
    e.name = JSONexerciceList[i].name;
    e.trainingFk = insertedTrainingId;

    let insertedExerciseId = null;

    await exerciseCollection.insertOne(e).then(res => {
      if(res.insertedId) insertedExerciseId = res.insertedId;
    }).catch(err => {
      console.log("error creating exercise: "+err);
      resPost.status(500).send("error creating exercise");
    });

    //create the exercise day

    let ed = new exerciseDay();
    ed.exerciseFk = insertedExerciseId;
    
    

    await trainingDayCollection.findOne({ day : JSONexerciceList[i].day }).then(res =>{
      console.log(JSONexerciceList[i].day);
      console.log("training-day: "+res);

      ed.trainingDayFk = res._id;
    }).catch(err => {
      console.log("cant find training-day: "+err);
      resPost.status(500).send("cant find training-day");
    });

    let insertedExerciseDayId = null;

    await exerciseDayCollection.insertOne(ed).then(res => {
      if(res.insertedId) insertedExerciseDayId = res.insertedId; 
    }).catch(err =>{
      console.log("cant insert exercise-day: "+err);
      resPost.status(500).send("cant insert exercise-day");
    });

    //iterate trough the set list and save them

    for(var j = 0; j<JSONexerciceList[i].sets.length ; j++){

      let es = new exerciseSet();
      es.exerciseDayFk = insertedExerciseDayId;
      es.repetitions = JSONexerciceList[i].sets[j].reps;
      es.weight = JSONexerciceList[i].sets[j].weight;

      await exerciseSetCollection.insertOne(es).then(res =>{
        console.log("exerciseSet saved"+res);
      }).catch(err => {
        console.log("cant save exerciseSet: "+err);
        resPost.status(500).send("cant save exercise-set");
      })


    }
  }

  resPost.status(200).send("{\"message\":\"Correctly saved\"}");

}

handler();

});







app.post("/saveSet", authenticateJWT, (req, res) => {

  async function saveSet(){

    const {user, setFk, date, reps, weight} = req.body;

    //find the user document
  
    const userFound = await userCollection.findOne({ User : user});

    //check if theres already a trainlog for the given day, if not, create it

    var trainLogFound = await trainingLogCollection.findOne({ userFK : userFound._id , date : date });

    if(trainLogFound === null){

      //as no traininglog was found, has to create one

      class trainingLog{

        userFK
        date

      };


      newTrainingLog = new trainingLog();

      newTrainingLog.userFK = userFound._id;
      newTrainingLog.date = date;

      await trainingLogCollection.insertOne(newTrainingLog);

      trainLogFound = await trainingLogCollection.findOne({ userFK : userFound._id , date : date });

    }

    //check if theres already a setLog for the given setFk

    var setLogFound = await setLogCollection.findOne({ setFK : setFk });

    if(setLogFound === null){
      //if no setLog was found, create a new one

      class setLog{
        trainingLogFK
        setFK
        repetitionsDone
        weightUsed
      };

      newSetLog = new setLog();
      newSetLog.trainingLogFK = trainLogFound._id;
      newSetLog.setFK = new ObjectId(setFk);
      newSetLog.repetitionsDone = reps;
      newSetLog.weightUsed = weight;

      await setLogCollection.insertOne(newSetLog);


    }else{

      //as a setlog exists, we update it

      setLogFound.repetitionsDone = reps;
      setLogFound.weightUsed = weight;

      await setLogCollection.updateOne({ _id : setLogFound._id}, { repetitionsDone : reps, weightUsed : weight });

    }


    res.status(200).send("{\"message\":\"Correctly saved\"}");


  }

  saveSet().catch( err => {
    console.log("error saving set : "+err);
    res.status(500).send("{\"message\":\"Something went wrong\"}");
  });

});



//get training by id

app.get("/getTrainingsById", authenticateJWT, (req, res) => {

  async function getTrainingById(){

    const trainingId = req.query.id;

    console.log(trainingId);


    let trainingFound = await trainingCollection.findOne({ _id : new ObjectId(trainingId) });

    class trainingLogResponse {

      trainingName
      creatorName
      exercises

    }

    class exerciseLogResponse { 

      exerciseName
      sets

    }

    class setResponse {
      dayName
      reps
      weight
      setId
    }

    tlr = new trainingLogResponse();
    tlr.trainingName = trainingFound.name;
    tlr.creatorName = await userCollection.findOne({ _id : trainingFound.creatorFK}).then(res => {return res.User});
    tlr.exercises = new Array();

    //find all exercises of the training

    exercisesCursor = await exerciseCollection.find({ trainingFk : trainingFound._id });

    while(await exercisesCursor.hasNext() == true){

      exerciseFound = await exercisesCursor.next();

      elr = new exerciseLogResponse();
      elr.exerciseName = exerciseFound.name;
      elr.sets = new Array();

      //find the exercise-day documents containing the found exercise

      exerciseDayCursor = await exerciseDayCollection.find({ exerciseFk : exerciseFound._id });

      while(await exerciseDayCursor.hasNext() == true ){

        exerciseDayFound = await exerciseDayCursor.next();

        //find sets that are related to the exerciseDay record

        exerciseSetCursor = await exerciseSetCollection.find({ exerciseDayFk : exerciseDayFound._id });
      
        while(await exerciseSetCursor.hasNext() == true){

          exerciseSetFound = await exerciseSetCursor.next();

          set = new setResponse();
          set.reps = exerciseSetFound.repetitions;
          set.weight = exerciseSetFound.weight;
          set.dayName = await trainingDayCollection.findOne({ _id : exerciseDayFound.trainingDayFk }).then(res => { return res.day });

          elr.sets.push(set);

        }

      }

      tlr.exercises.push(elr);

    }

    res.status(200).json(tlr);

  };


  getTrainingById().catch(err => {
    console.log("cant get training by id: "+ err);
    res.status(500).send("{\"message\":\"Something went wrong\"}");
  });

});


//create the rating training method

















app.get("/getTrainingsByName", authenticateJWT,  (req, res) =>{



  async function getTrainingByName(){

    const name = req.query.name;

    const page = req.query.page;

    console.log(name);
  
    console.log(page);


    class trainingLogResponse {

      id
      name
      creatorFK
      exercises
      rating
      noOfRatings

    }
  
    var trainingResponseArray = new Array();



  
    trainingCursor = trainingCollection.find({ name : new RegExp('.*' + name + '.*') }).skip(20 * page).limit(20);
  
    while(await trainingCursor.hasNext() == true){

      var actualTraining = await trainingCursor.next();

      tlr = new trainingLogResponse();
      tlr.id = actualTraining._id;
      tlr.name = actualTraining.name;
      tlr.creatorFK = actualTraining.creatorFK;


      //rating calculation with aggregation functions


      avgRatingCalculatedCursor = await trainingRatingCollection.aggregate(
        [
          {
            $match: { trainingFK: actualTraining._id }
          },
          {
            $group:
              {
                _id: "$trainingFK",
                avgRating: { $avg: "$rating" },
                noOfRatings: { $count : {}}
              }
          }
        ]
      );

      avgRatingCalculated = null;

      
      if(await avgRatingCalculatedCursor.hasNext() == true){
        console.log("avg rating cursor has next");
        avgRatingCalculated = await avgRatingCalculatedCursor.next();
        tlr.rating = avgRatingCalculated.avgRating;
        tlr.noOfRatings = avgRatingCalculated.noOfRatings;
      }


      

      


      trainingResponseArray.push(tlr);
    }
  
    res.status(200).json(trainingResponseArray);
  


    
  };

  getTrainingByName().catch( err => {
    console.log("cant get training by name : "+ err);
    res.status(500).send("{\"message\":\"Something went wrong\"}");
  })

  





});




app.post("/rateTraining", authenticateJWT, (req, res) => {

  async function rateTraining(){


    const { trainingFK, userName, rate, comment} = req.body;

   

    class trainingRating{
      
      userFK
      trainingFK
      rating
      comment

    };


    userFound = await userCollection.findOne({ User : userName });



    var rateTrainingFound = await trainingRatingCollection.findOne({ trainingFK : new ObjectId(trainingFK), userFK : userFound._id });

    if(rateTrainingFound == null){

      newRating = new trainingRating();
      newRating.userFK = userFound._id;
      newRating.trainingFK = new ObjectId(trainingFK);
      newRating.rating = Number.parseInt(rate);
      newRating.comment = comment;

      await trainingRatingCollection.insertOne(newRating);
    }else{
      
      await trainingRatingCollection.updateOne({ _id : rateTrainingFound._id }, { $set: { userFK : userFound._id, trainingFK : new ObjectId(trainingFK), rating : rate.toString(), comment : comment} } );
    }

    res.status(200).json({ message : 'correctly saved'});

  }

  rateTraining().catch(err => {
    console.log("cant rate training : "+err);
    res.status(500).json({ message : 'something went wrong '});
  });



});

app.get("/getRatingByUserAndTraining", authenticateJWT, (req, res) => {

  async function getRatingByUserAndTraining(){

    const { userName, trainingFK } = req.query;

    console.log(trainingFK);

    userFound = await userCollection.findOne({ User : userName });

    trainingRatingFound = await trainingRatingCollection.findOne({ userFK : userFound._id, trainingFK :  new ObjectId(trainingFK) });

    res.status(200).json(trainingRatingFound);

  }


  getRatingByUserAndTraining().catch(err => {
    console.log("cant get rating by user and training: "+err);
    res.status(500).json({ message : 'something went wrong'});
  });

});


app.get("/getRatingsPage", authenticateJWT, (req, res) => {


  async function getRatingPage(){

    const { trainingFK, pageNo } = req.query;

    console.log(trainingFK);

    trainingRatingList = new Array();

    trainingRatingCursor = await trainingRatingCollection.find({ trainingFK: new ObjectId(trainingFK) }).skip(20 * pageNo).limit(20);


    class trainingRatingResponse{
      id
      userFK
      trainingFK
      rating
      comment
    }

    while(await trainingRatingCursor.hasNext() == true){


      trainingRatingFound = await trainingRatingCursor.next();

      trr = new trainingRatingResponse();
      trr.id = trainingRatingFound._id;
      trr.userFK = await userCollection.findOne({ _id : trainingRatingFound.userFK });
      trr.trainingFK = trainingRatingFound.trainingFK;
      trr.rating = trainingRatingFound.rating;
      trr.comment = trainingRatingFound.comment;

      trainingRatingList.push(trr);

    }

    res.status(200).json(trainingRatingList);

  }

  getRatingPage().catch(err => {
    console.log("can't get the ratings : "+err);
    res.status(500).json({ message : 'something went wrong'});
  });



});






app.get("/isUsernameTaken", authenticateJWT, (req, res) => {


  async function isUserNameTaken(){

    const { userName, id} = req.query;

    isTaken = null;

    userFound = await userCollection.findOne({ User : userName });

    if(userFound && userFound._id == id){
      res.status(200).send(true);
    }else{
      res.status(200).send(null);
    }

  }

  isUserNameTaken().catch(err => {
    console.log("cant get usernameTaken: "+err);
    res.status(500).json({message : "something went wrong"});
  });
});







app.post("/updateUser", authenticateJWT, (req, res) => {

  async function updateUser(){

  //implement update user method

  const { id, userName, password, email } = req.body;

  updatingResult  = await userCollection.updateOne({ _id : new ObjectId(id) }, { $set : { User : userName, password : password, Email : email }});

  if(updatingResult.modifiedCount > 0){
    res.status(200).json({message: 'Correctly updated'});
  }else{
    res.status(500).json({message : 'something went wrong'});
  }


  }


  updateUser().catch(err => {
    console.log("cant update user : "+err);
    res.status(500).json({ message : "something went wrong"});
  });
});




app.post("/setTrainingActive", authenticateJWT, (req, res) => {

  async function setTrainingActive(){


    const { id , user } = req.body;

    console.log(id);

    userFound = await userCollection.findOne({ User : user});

    trainingFound = await trainingCollection.findOne({ _id : new ObjectId(id)});

    userTrainingsFound = await trainingOfUserCollection.findOne({ user : userFound._id , training : trainingFound._id });

    if(userTrainingsFound == null){

      class trainingOfUser{

        user
        training
        isActive
    
      }

      newTrainingOfUser = new trainingOfUser;
      newTrainingOfUser.user = userFound._id;
      newTrainingOfUser.training = trainingFound._id;
      newTrainingOfUser.isActive = "true";

      await trainingOfUserCollection.insertOne(newTrainingOfUser);

      res.status(200).json({ message : 'correctly saved'});
    }else if(userTrainingsFound.isActive == "false"){
      await trainingOfUserCollection.updateOne({user : userFound._id , training : trainingFound._id }, { $set : { isActive : "true" }});

      res.status(200).json({ message: 'correctly saved'});
    }else{
      res.status(401).json({ message : 'training is already active'});
    }

  }

  setTrainingActive().catch(err => {
    console.log("error setting training active"+err);
    res.status(500).json({ message : 'something went wrong'});
  })

})




app.listen(3000, function () {
  console.log('listening on '+port)
});
