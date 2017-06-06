$(document).ready(function(){
   var TOOLBOXPAT = /(\\[A-Za-z_]+( [\w.]+|\s*$)|^\s*$)/;
   var MB_SIZE = Math.pow(10,6);
   var ACCEPTABLEMG = 8;
   var STDMKRS = ["\\t ",
                  "\\f ",
                  "\\g ",
                  "\\l ",
                  "\\m "];
   var STDINTERP = {"\\t ":"text",
                  "\\f ":"translation",
                  "\\g ":"gloss",
                  "\\l ":"language",
                  "\\m ":"morphemes"};
   var XIGTNAMESPACE = ["words"];
   var ACCEPTABLEINTERPRETATIONS = {"w": ["words", "text"],
                  "m": ["morphemes", "morphs", "morph"],
                  "g": ["glosses", "gloss"],
                  "pos": ["part of speech", "pos", "parts of speech"],
                  "t": ["translation", "transliteration", "free translation"],
                  "l" : ["literal translation"]};
   var POSSIBLE_DELIMITED_SECTIONS = ["igt", "corpus", "chapter", "paragraph"];
   var NA = "n/a"
   var REQDELIM = ['igt'];
   var MAX_LINE_WRAPPED_LENGTH = 180;
   var LINE_LENGTH_STDEV = 32;

   //Which step of upload process the user has progressed to
   var stepNumber = 1;

   // This could one dayFormData object, but currently only has spotty support across browsers
   var uploadData = {};

   $('.confirm').hide();

   $("#file_button").prop("disabled", true);

   $("#file_button").on("click", function(){
      renderConfirmationPage(uploadData['file']);
   });

   $("#file-submission").on("change", getFileText);

   $("#delimit-button").on("click", function(){
      getDelimiters(uploadData);
   });

   $("#metadata-button").on("click", function(){
      getMetadata(uploadData);
   });

   $("#final_button").on("click", function(){
      getContentMarkers(uploadData);
      console.log(uploadData);
      if(validUserInput(uploadData)){
         $.ajax({type: 'POST',
            contentType: 'application/json',
            dataType : 'json',
            url: "http://127.0.0.1:5000/",
            data: JSON.stringify(uploadData)
         });
      }
   });

   $(".add-button .delimiter").on("click", function(){
      renderConfirmationPage(uploadData['file']);
   });

   function getFileText(event){
      var userFile = event.target.files[0];

      if (!userFile) {
         return;
      }

      var reader = new FileReader();
      reader.onload = function(event){
         var contents = event.target.result;
         var fileSize = contents.length;

         /*
         Verify that the file is valid
         */

         // Checks file extension is txt
         if( !isToolboxFileName(userFile.name)){
            $("#file_button").prop("disabled", true);
            alert("File must use .txt extension");
         }

         // Checks file is within required size
         else if (fileSize > ACCEPTABLEMG*MB_SIZE){
            $("#file_button").prop("disabled", true);
            alert("File must be less than " + ACCEPTABLEMG +"MB");
         }

         // Checks if file matches format of toolbox data
         else if( !isToolboxFormat(contents) ){
            $("#file_button").prop("disabled", true);
            alert("The selected file's format doesn't look like toolbox data.");
         }

         else{
               $("#file_button").prop("disabled", false);
               uploadData["file"] = contents;
         }

      };
      reader.readAsText(userFile);
   }

   /* The confirmation page has 4 parts:
   //    0.) A preview of their toolbox file
   //    1.) Have the user designate their delimiter markers
   //    2.) Have the user designate their section-level metadata markers
   //    3.) Have the user describe their content markers
   //       i.) marker interpretations
   //       ii.) preferred xigt id-marker
   //       iii.) attributes for that marker
   //       vi.) notes for that marker
   */
   function renderConfirmationPage(userFile){
      $('.upload').hide();
      $('.confirm').show();

      $('.delimiter').hide();
      $('.metadata').hide();
      $('.content-marker').hide();

      // Preview of Toolbox data
      renderToolboxPreview();
      $("#steps").fadeIn(900)
      $("#steps").text(stepNumber + " / 4")

      // Renders
      renderDelimiter();


      // See renderMetadata

      // See render contentMarkers
   }

   // Generates a table with the user's toolbox file
   function renderToolboxPreview(){
      //Get the user's markers and data, and wrap it
      var userFile = uploadData['file'];
      var previewFileSections = userFile.split(/(\n\r|\n)(\n\r|\n)+/g);
      console.log(previewFileSections);
      var previewFile = "";
      var i = 0;
      while(i < previewFileSections.length){
         if(previewFileSections[i].split(/[\n\r]+/g).length < 8){
            console.log(previewFileSections[i].split(/[\n\r]+/g));
            i++;
         }
         else{
            previewFile = previewFileSections[i];
            break;
         }
      }
      var lineMarkers = previewFile.match(/\\[a-zA-Z]+[a-zA-Z_0-9]*/g);
      var lines = {};
      var order = [];

      for(var line of previewFile.split(/\n/g)){
         line = line.split(/( )+/);
         if(line[0] in lines){
            lines[line[0]] += line.slice(1).join(" ");
         } else{
               lines[line[0]] = line.slice(1).join(" ");
               order.push(line[0]);
         }
      }

      for(var marker of order){
         $tr = $("<tr>");
         $tdMarker = $("<td>");
         $tdData = $("<td>")

         // Add content to cells
         $tdMarker.append(marker);
         $tdData.append(lines[marker]);

         // Add cells to row
         $tr.append($tdMarker);
         $tr.append($tdData);
         $("#sample-file").append($tr);
      }
   }

   function renderDelimiter(){
      stepNumber++;
      $("#steps").text(stepNumber + " / 4")

      var userFile = uploadData['file'];
      var delimtCol = ["section", "marker-used"];
      var $delimiterTable = genTable(REQDELIM, delimtCol);
      var userMarkers = new Set(getMarkers(userFile));      $("#delimiter-form").append($delimiterTable);


      for(var section of REQDELIM){
         $("." + section + " ." + delimtCol[0]).append(section);
         var delimitInfo = {name:section, class:section};
         $sectionSelect = genSelect(delimitInfo, userMarkers);
         $("." + section + " ." + delimtCol[1]).append($sectionSelect);
      }
      var addInfo = {id:"delimit-add-text", class:"add-button"};
      var $add = $('<p>');
      $add.text("Click to add text");
      $('.delimiter').fadeIn(600);
   }

   function renderMetadata(){
      stepNumber++;
      $("#steps").text(stepNumber + " / 4")

      $("table.meta").remove();
      var usedMarkers = getMarkers(uploadData['file']);
      usedMarkers = setSubtract(usedMarkers, Object.values(uploadData['delimiters']));
      var columns = ["delimiter", "metadata-marker-used"];
      var usedDelimiters = Object.keys(uploadData['delimiters']);
      var $metadataTable = genTable(usedDelimiters, columns);
      $metadataTable.addClass("meta");
      $("#metadata-form").append($metadataTable);

      for(var delim of usedDelimiters){
         $("." + delim + " ." + columns[0]).append(delim);

         var cellInfo = {name:delim, class:delim};
         $delimSelect = genSelect(cellInfo, setSubtract(usedMarkers, usedDelimiters));
         $("." + delim + " ." + columns[1]).append($delimSelect);
      }
      addDupColumn("table.meta");
      $('.metadata').fadeIn(600);
   }

   function renderContentMarkers(){
      stepNumber++;
      $("#steps").text(stepNumber + " / 4")

      $("table.content").remove();
      var remainingMkrs = getMarkers(uploadData['file']);
      remainingMkrs = setSubtract(remainingMkrs, Object.values(uploadData['delimiters']));
      remainingMkrs = setSubtract(remainingMkrs, Object.values(uploadData['metadata']));
      var columns = ["marker", "tier-id", "interpretation", "attribute", "note"];
      var columnText = ["Your marker", "Xigt Tier ID", "Interpretation", "Attributes", "Notes"]
      var $contentmarkersTable = genTable(remainingMkrs, columns);
      var $headerRow = $("<tr>");

      for(var text of columnText){
         $th = $("<th>");
         $th.attr('class', text.toLowerCase());
         $th.append(text);
         $headerRow.append($th);
      }

       $contentmarkersTable.append($headerRow);
       $contentmarkersTable.addClass("content");
      $("#content-marker-form").append($contentmarkersTable);

      for(var mkr of remainingMkrs){
         // Marker
         $mkr = $("<td>", {class:[mkr, "marker"].join(" ")});
         $mkr.append(mkr);

         // Tier ID
         $tierID = $("<td>", {class:"tier-id"});

         var inputInfo = {class: "tier-id", size: "10", maxlength: "7", type: "text", name:mkr + "-" + "tier-id", value:mkr.slice(1,3)};
         $tierID.append($("<input>", inputInfo));

         // Interpretation
         $interpretation = $("<td>", {class:"interpretation"});

         var interpInfo = {type: "text", name:mkr + "-" + "interpretation"};
         var $interpSelect = genSelect(selectInfo, Object.values(STDINTERP));
         $interpSelect.addClass("interpretation");
         $interpSelect.attr("name", mkr + " -interpretation");
         $interpretation.append($interpSelect);

         // Attribute
         $attribute = $("<td>", {class:"attributes"});

         var selectInfo = {type: "text", name:mkr + "-" + "attribute"};
         $attributSelect = genSelect(selectInfo, ["foo", "bar"]);
         $attributSelect.addClass("attributes");
         $attributSelect.attr("name", mkr + " -attribute");
         $attribute.append($attributSelect)

         // Note
         $note = $("<td>", {class:"note"});

         var noteInfo = {type: "text", name:mkr + "-" + "note-id"};
         $note.append($("<input>", noteInfo));

         $tr = $("<tr>", {class:mkr});

         $tr.append($mkr);
         $tr.append($tierID);
         $tr.append($interpretation);
         $tr.append($attribute);
         $tr.append($note);

         $contentmarkersTable.append($tr);
      }

      $('.content-marker').fadeIn(600);
   }

   // Creates an html table, where each <td> element
   // has as its row and col attributes as classes
   function genTable(rowSpace, colSpace){
      $table = $("<table>");
      for(var row of rowSpace){
         $tr = $("<tr>", {class:row});
         for(var col of colSpace){
            $td = $("<td>");
            $td.addClass(row + " " + col);
            $tr.append($td);
         }
         $table.append($tr);
      }
      return $table;
   }

   // Generates an html select element
   // selectInfo includes things like, class, id, etc.
   function genSelect(selectInfo, options){
      $select = $("<select>", selectInfo);
      for(var option of options){
         $option = $("<option>", {value:option});
         $option.append(option);
         $select.append($option);
      }
      var $na = $("<option>", {value:NA});
      $na.append("n/a");
      $na.prop("selected", true);
      $select.append($na);
      return $select
   }

   /*
      Validates various information the user has input including:
         There is a mapping from the toolbox markers used to tier types
            "tier_map"
         Their igts used \\id and \\ref
            "igt_attribute_map"
         The mapping is either one-to-one, or many-to-one (no one-to-many or many-many-many)
   */
   function validUserInput(uploadData){
      return validID(Object.values(uploadData["content-markers"]["tier-id"]));
   }

   // Checks whether the text in the file is valid toolbox data
   function isToolboxFormat(fileText){
      var inconsistentStringCount = 0;
      var documentLength = 0 ;
      var igts = fileText.split("\n\n");
      for(var i=0; i<igts.length; i++){
         var lines = igts[i].split("\n");
         for(var j=0; j<lines.length; j++){
            //I'm using a statistical approach here, because
            //this is a very, very difficult problem
            documentLength++;
            if (!(lines[j].trim().match(TOOLBOXPAT))){
               inconsistentStringCount++;
            }
         }
      }
      console.log(inconsistentStringCount);
      console.log(documentLength);
      console.log(inconsistentStringCount/documentLength)
      return inconsistentStringCount/documentLength < .2;
   }

   // Checks file-extension is acceptable
   function isToolboxFileName(fileExtension){
      var acceptableFormats = /(([A-Za-z_]*\.)+(txt|TXT)+|[A-Za-z_]+^.)/;

      return fileExtension.match(acceptableFormats);
   }

   function getDelimiters(uploadData){
      var delimiters = getFormData($('#delimiter-form'));
      if(validDelimiters(delimiters)){
         uploadData['delimiters'] = getFormData($('#delimiter-form'));
         renderMetadata(uploadData['file']);
      } else{
         alert("You need to at least have delimiters for these:\n" +REQDELIM.join("\n"));
      }
   }

   function getMetadata(uploadData){
      var delimiters = getFormData($('#metadata-form'));
      uploadData['metadata'] = getFormData($('#metadata-form'));
      renderContentMarkers(uploadData['file']);
   }

   function getContentMarkers(uploadData){
      uploadData["content-markers"] = {}
      var markerData = getFormData($('#content-marker-form'));
      var columns = {};
      for(var cell of Object.keys(markerData)){
         var rowCol = cell.split(" -");
         var col = rowCol[1];
         var row = rowCol[0];
         if(columns[col] === undefined){
            columns[col] = {};
         }
         if(markerData[cell] != ""){
            columns[col][row] = markerData[cell];
         }
      }
      for(var col of Object.keys(columns)){
         uploadData["content-markers"][col] = columns[col];
      }
      validID(Object.values(uploadData["content-markers"]["tier-id"]));
   }

   function getMarkers(contents){
      var markerFormat = /\\[A-Za-z_][A-Za-z_0-9]* /g;
      return contents.match(markerFormat);
   }

   // Checks if two Sets are mutual subsets, and thus equal 'sets'
   function setEq(s1, s2){
      if (s1.length !== s2.length){
         return false;
      }
      return isSubset(s1,s2) && isSubset(s2,s1);
   }

   // checks if Set s1 is subset of s2
   function isSubset(s1, s2){
      var flag = true;

      for(let i of s1.values()){
         flag = true;
         for(let j of s2.values()){
            if(i == j){
               flag = false;
               break;
            }
         }
         // If flag here, then some value i in s1 is not present in s2
         if(flag) break;
      }

      return !flag;
   }

   // Returns new set cotaining all the elements in s1, and NOT in s2
   function setSubtract(s1, s2){
      var subtractedSet = new Set();
      var flag = true;
      for(var s1Element of s1){
         flag = true;
         for(var s2Element of s2){
            if(s1Element === s2Element){
               flag = false;
               break;
            }
         }
         if(flag){
            subtractedSet.add(s1Element);
         }
      }
      return subtractedSet;
   }

   // Grabs form data and puts it into uploadData
   function getFormData(formObject){
      return formObject.serializeArray().reduce(
         function(obj, item){
            if(item.value != NA){
               obj[item.name] = item.value.toLowerCase();
            }
            return obj;
         },
      {});
   }

   function validDelimiters(delimiters){
      for(var i=0; i<REQDELIM.length; i++){
         if(!(REQDELIM[i] in delimiters)){
            return false;
         }
      }
      return true;
   }

   function validID(ids){
      for(var id of ids){
         if (!id.match(/[A-Za-z_][A-Za-z0-9_-]*/)){
            alert("\""+ id + "\" is an invalid xigt id name");
            return false;
         }
      }
      return true;
   }

   function sortInput(userInput){
      var meta = {};
      var attr = {};
      var tier_map = {};
      for(var key of Object.keys(userInput)){
         if(key.split("_").length < 2){
            tier_map[key] = userInput[key]
         }
         else{
            if(key.split("_")[1] === "attr"){
               attr[key.split("_")[0]] = userInput[key]
            }
            if(key.split("_")[1] === "meta"){
               meta[key.split("_")[0]] = userInput[key]
            }
         }
      }
      return {"meta":meta, "attr":attr, "tier_map":tier_map};
   }

   function genTierMap(marker_interps){
      $('.error').remove();
      var tierMap = {}
      var acceptableInterpretations = Object.keys(ACCEPTABLEINTERPRETATIONS);
      for(var defaultMkr of acceptableInterpretations){
         for(var userMkr of Object.keys(marker_interps)){
            if(ACCEPTABLEINTERPRETATIONS[defaultMkr].includes(marker_interps[userMkr])){
               tierMap[userMkr] = defaultMkr;
               break;
            }
         }
         if(!(userMkr in tierMap)){
            var message = "I'm not sure which marker has the interpretation of " + ACCEPTABLEINTERPRETATIONS[defaultMkr][0];
            var id = "error-" + ACCEPTABLEINTERPRETATIONS[defaultMkr][0];
            var errorMessage = $("<div class='error' id="+id+">" + message + "</div>").hide().fadeIn(600);
            $('#confirm-wrapper').append(errorMessage);
         }
      }
      return tierMap;
   }

   function addDupColumn(table){
      console.log($(table + " tr"));
      if($(table + " tr").length == 1){
         console.log($(table + " tr").find("td:last"));
         $(table + " tr").append($(table + " tr").find("td:last"));
         console.log($(table));
      } else {
         for(var tr of $(table + " tr")){
            tr.append(tr.find("td:last"));
         }
      }
   }
});
