//getItem("election Data") retrieves info saved by admin.html
//JSON.parse(saved data converts the stored string back into a js object)
const savedData = sessionStorage.getItem("electionData");
console.log(savedData);
const savedElection = JSON.parse(savedData);


const types = document.getElementById("types");
const maxChoixField = document.getElementById("maxChoixField");
const totalPointsField = document.getElementById("totalPointsField");

const maxChoix = document.getElementById("maxChoix");
const totalPoints = document.getElementById("totalPoints");

    let election = null;   //No valid configuration exists yet

const message = document.getElementById("message");
const output = document.getElementById("output");

    
    function updateElection(){

        message.textContent = "";
        output.textContent = "";
        election = null;


//First, hide both fields because if the user chooses Pondéré and then changes his mind, both fields will be visible
    maxChoixField.hidden = true;
    totalPointsField.hidden = true;


    if (types.value === "multiple"){
        maxChoixField.hidden = false;

        if (maxChoix.value === ""){
            message.textContent = "Maximum choices are required";
        }
        else if (!Number.isInteger(Number(maxChoix.value))){
            message.textContent = "Enter a whole number";
        }
        else if(Number(maxChoix.value) <= 0) {
            message.textContent = "Enter a positive number";
        }
        else {
        election = {
                type:"multiple",
                options: {
                    maxChoix: Number(maxChoix.value)
                }
            }
        }
    }
    else if (types.value === "pondere"){
        totalPointsField.hidden = false;

        if (totalPoints.value === ""){
            message.textContent ="Total points are required";
        }
        else if(!Number.isInteger(Number(totalPoints.value))) {
            message.textContent = "Enter a whole number";
        }
        else if (Number(totalPoints.value) <= 0){
            message.textContent = "Enter a positive number";
        }
        else {

        election = {
                type: "pondere",
                options: {
                    totalPoints:Number(totalPoints.value)
                }
            };
        }
    }
    else if (types.value === "uninominal"){
        

        election = {
            type: "uninominal", 
            options: {}
        };
    }
    
    const finalElection = {
    ...savedElection,
    ...election
    };
    output.textContent = JSON.stringify(finalElection, null, 4);
    window.electionConfig = election;     //Stores the selected voting type and its options in a global variable
                                         //so other functions in the same page can access it
}


//types: The drop down menu retrieved from html
//addEventListener: tells js to listen for an event 
//"change":the event occurs when the selected value changes
//function() contains the instructions js must execute when that happens

types.addEventListener("change", updateElection);
maxChoix.addEventListener("input", updateElection);
totalPoints.addEventListener("input", updateElection);


updateElection();

window.addVotingConfig = function(electionObject){

    if (electionObject === null ||window.electionConfig === null){     //Does the original election object exist or is the voting configuration valid?
        return null;
    }

    return{
        ...electionObject,
        ...window.electionConfig
    };
};


