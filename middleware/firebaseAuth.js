const admin= require('../config/firebase');
const { query } = require('../config/database');

exports.verifyFirebaseToken = async (req, res, next) => {

  try {
    //Extract token from header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = authHeader.split("Bearer ")[1];
  //Verify token with firebase
    const decodedToken = await admin.auth().verifyIdToken(token);
    //Attach user info to a request
    const [users]=await query('SELECT user_id, email, user_role, phone FROM users WHERE user_id = ?',
      [decodedToken.uid]
    );
    if(users.length===0){
      return res.status(404).json({error: "User not found"});
    }
    const user = users[0];
    req.user = {
      id: decodedToken.uid,
      email: user.email,
      phone: user.phone,
      role: user.role
    };
    //Onto next middleware
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
  if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Token expired', 
        message: 'Please log in again' 
      });
    }
  return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid token' 
    });
  }
};


/*const optionalAuth= async (req,res,next)=>{
  try{
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const [users]=await db.query('SELECT user_id, email, user_role, phone FROM users WHERE firebase_uid = ?',
      //MUST UPDATE DATABASE TO INCLUDE NEW COLUMN FOR user
      [decodedToken.uid]
    );
    if(users.length>0){
      req.user = {
        id: users[0].user_id,
        email: users[0].email,
        role: users[0].role,
        firebaseUid: decodedToken.uid
      };

    }
    next();
  }
  catch(error){next()}
}*/
