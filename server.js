const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const { auth } = require("express-oauth2-jwt-bearer");
const { join } = require("path");
const authConfig = require("./auth_config.json");
const managementApiKey = authConfig.managementApiKey;

const app = express();

if (!authConfig.domain || !authConfig.audience) {
  throw "Please make sure that auth_config.json is in place and populated";
}

app.use(morgan("dev"));
app.use(helmet());
app.use(express.static(join(__dirname, "public")));

const checkJwt = auth({
  audience: authConfig.audience,
  issuerBaseURL: `https://${authConfig.domain}`,
});

app.get("/api/external", checkJwt, (req, res) => {
	pizzaname = req.query.pizzaname
	
	//Check for JWT scopes among other things
	const auth = req.auth;
	//auth.header; // The decoded JWT header.
	//auth.payload; // The decoded JWT payload.
	//auth.token; // The raw JWT token.
	
	//Check if the scope includes the "profile" scope, since a scope is required according to the task
	if(auth.payload.scope.includes("profile")){
		
		//Create a placeholder for adding the updated metadata JSON in
		addorder="";
		
		//URL for getting existing pizza orders from the app_metadata. In reality it doesn't really make sense to store this data here, should be in an external DB but this is just a demo so let's go:
		const url = 'https://dev-bl85tkuioarg4w4l.us.auth0.com/api/v2/users/'+auth.payload.sub;
		
		//Headers for the Curl request
		const headers = {'Content-Type': 'application/json','Accept': 'application/json','Authorization': 'Bearer '+managementApiKey
		};
		
		//Let's get the existing pizza orders!
		fetch(url, {
			method: 'GET',
			headers: headers
		})
		.then((response) => response.json())
		.then((data) => {
				
				//If no existing pizza orders exists, add a new one (really ugly solution this one, but works...)
				if(typeof data.app_metadata == "undefined") {
					data.app_metadata = JSON.parse('{"pizzaorders": [{ "timestamp": "'+new Date().toISOString()+'", "pizzaname": "'+pizzaname+'" }]}');	
				}
				else {
					//If a pizzaorder array exists, add the ordered pizza into it
					data.app_metadata.pizzaorders.push({ "timestamp": new Date().toISOString(), "pizzaname": pizzaname })
				}
				
				addorder = data.app_metadata
				
				//URL for posting the updated pizza JSON to app_metadata
				const posturl = 'https://dev-bl85tkuioarg4w4l.us.auth0.com/api/v2/users/'+auth.payload.sub;
				const postdata = addorder;
				
				//Headers
				const postheaders = {'Content-Type': 'application/json','Accept': 'application/json','Authorization': 'Bearer '+managementApiKey
				};
				
				//Send the PATCH request to the API with the updated pizza array to update app_metadata
				fetch(posturl, {
					method: 'PATCH',
					headers: postheaders,
					body: JSON.stringify({"app_metadata":postdata}),
				})
				.then((response) => response.json())
				.then((data) => {
						//app_metadata updated with the ordered pizza, tell the user what they ordered
						res.send({
							msg: "Pizza "+pizzaname+" ordered! 🍕🔥"
						});
				});
		
				
			});
	}
	else {
		//If the user don't have the profile scope enabled, fail the API request and tell the user absolutely nothing useful about how to solve the problem
		res.send({
			msg: "You are missing the right permissions to order pizza, please contact the pizza gods 👮🏼"
		});
	}

});

app.get("/auth_config.json", (req, res) => {
  res.sendFile(join(__dirname, "auth_config.json"));
});

app.get("/*", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

app.use(function(err, req, res, next) {
  if (err.name === "UnauthorizedError") {
    return res.status(401).send({ msg: "Invalid token" });
  }

  next(err, req, res);
});

process.on("SIGINT", function() {
  process.exit();
});

module.exports = app;
