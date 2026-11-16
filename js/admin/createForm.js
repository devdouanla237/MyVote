function getFormData(){


const Formulaire = document.getElementById("form");  //document represents the entire html page in js

const titreInput = Formulaire.elements["title"];   //Get the title input by id 
const descriptionInput = Formulaire.elements["descr"];   //const creates a value which cannot be reasigned
const dateFinInput = Formulaire.elements["time"];

//Read the values entered by the user
//.value retrieves the content entered by user
//trim removes spaces at the beginning and at the end
const titre = titreInput.value.trim();
const description = descriptionInput.value.trim();


if (titre.length < 1 || titre.length > 100) {
    alert("Title must contain between 1 and 100 characters.");
    return null;
}


//Convert date into milliseconds
//let because we will assign different values depending on the condition
let dateFin;

if (dateFinInput.value === "") {
    dateFin = null;
}
else {
    dateFin = new Date(dateFinInput.value).getTime();
}

const formData = {
    titre: titre,
    description: description,
    dateFin: dateFin
};
return formData;

}

const bouton = document.getElementById("button");

bouton.addEventListener("click", function() {

    const formData = getFormData();
    if (formData === null) {
    return;
}

    const jsonResult = JSON.stringify(formData, null, 4);

    const resultat = document.getElementById("résultat");

    resultat.textContent = jsonResult;

});