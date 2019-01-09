var fcNames = d3.map();
var hubNames = d3.map();
var zipMapColor = d3.map();
var overallZipVolume = d3.map();
var geoPath;
var us_roads;
var us_zipcodes;
var fcGeocode;
var hubGeocode;
var projection;
var filteredData;
var zipSourceData;
var zipFCCollection;
var zipHubCollection;
var zipVolumeCollection;
var zipCarrierCollection;
var globalFCSelectorValue;
var globalHubSelectorValue;
var globalCarrierSelectorValue;
var globalStateSelectorValue;
var selectedState = 'None Selected';
var width = 950;
var height = 590;
var maxZip3 = 999;
var minZip3 = 001;
var tooltipSet = false;
var filteredMinVol = 0;
var volumeThreshold = 20;
var filteredMaxVol = volumeThreshold;
var stateSelectorOptions = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
// TODO: Enable City
var stateCities = d3.map();
var globalCitySelectorValue;
var selectedCity = 'None Selected';
var zipCityData;

/*
 * Main onload function used to generate the dropdown selectors and the "save as png" function
 */
window.onload = function () {
  // Getting BU, HUB and FC data by sending a json request
  var url = 'js/data/footprint_dropdown.json';
  var request = new XMLHttpRequest();
  request.open("GET", url, false);
  request.send();
  selectorOptions = JSON.parse(request.responseText);

  // Init all the page selectors/dropdowns. 
  // Note: only BU and State have 'default' data; the others are populated once a BU is selected
  loadSelector('bu', selectorOptions);
  loadSelector('fc', []);
  loadSelector('hub', []);
  loadSelector('carrier', []);
  loadSelector('state', stateSelectorOptions);
  // TODO: Enable City  
  loadSelector('city', []);

  // Adding the logic for the selector "onChange" event
  // Note: only BU has the original onChange event, others are listening for a custom trigger created in
  //       .js/lib/bootstrap-multiselect (lines: 110-147)
  $('#bu').change(function () {
    reRenderMap(selectorOptions, this);
  });
  $('#fc').on('fcSelectorChanged',function () {
    // Check if the user actually made a change or the selection remained the same. If new values where selected then, refresh/re-render map
    var currentFCSelectorValue = $('#fc').val();
    var skipRender = checkSkipRender(globalFCSelectorValue, currentFCSelectorValue);
    if (!skipRender) {reRenderMap(selectorOptions, this);}
  });
  $('#hub').on('hubSelectorChanged',function () {
    // Check if the user actually made a change or the selection remained the same. If new values where selected then, refresh/re-render map
    var currentHubSelectorValue = $('#hub').val();
    var skipRender = checkSkipRender(globalHubSelectorValue, currentHubSelectorValue);
    if (!skipRender) {reRenderMap(selectorOptions, this);}
  });
  $('#carrier').on('carrierSelectorChanged',function () {
    // Check if the user actually made a change or the selection remained the same. If new values where selected then, refresh/re-render map
    var currentCarrierSelectorValue = $('#carrier').val();
    var skipRender = checkSkipRender(globalCarrierSelectorValue, currentCarrierSelectorValue);
    if (!skipRender) {reRenderMap(selectorOptions, this);}
  });
  $('#state').on('stateSelectorChanged',function () {
    // Check if the user actually made a change or the selection remained the same. If new values where selected then, refresh/re-render map
    selectedState = $('#state').val();
    selectedState = (selectedState === null) ? 'None Selected' : selectedState;
    var skipRender = checkSkipRender(globalStateSelectorValue, selectedState);
    if (!skipRender) {reRenderMap(selectorOptions, this);}

    // TODO: Enable City
    selectedCity = 'None Selected';
    if (selectedState === 'None Selected') {
      reloadSelector('city',[],this.id);
    } else {
      var tempCities = new Array();
      for (var s in selectedState) {
        if (typeof stateCities.get(selectedState[s]) !== 'undefined') {
          tempCities = tempCities.concat(stateCities.get(selectedState[s]));
        }
      }
      reloadSelector('city',tempCities,this.id);
    }
  });
  // TODO: Enable City
  $('#city').on('citySelectorChanged',function () {
    selectedCity = $('#city').val();
    selectedCity = (selectedCity === null) ? 'None Selected' : selectedCity;
    var skipRender = checkSkipRender(globalCitySelectorValue, selectedCity);
    if (!skipRender) {
      reRenderMap(selectorOptions, this);
    }
  });

  $('input[name=displayLocation]').change(function() {displayLocation()});
  
  // Set-up the export (saveAsPng) button
  // Will use Promises to execute the "loading screen" first, then call the saveAsPng functions and finally hide the "loading screen"
  d3.select('#saveButton').on('click', function () {
    var savePngPromise = new Promise(function (resolve, reject) {
      $("#loader").show();
      $("#overlay").show();
      setTimeout(function () {resolve('saveSvgAsPng');}, 100);
    });
    savePngPromise.then(function (value) {
      var savePngPromise2 = new Promise(function (resolve, reject) {
        saveSvgAsPng(document.getElementsByTagName("svg")[0], "deliveryFootprint.png", {scale: 2, backgroundColor: "#FFFFFF"});
        setTimeout(function () {resolve('saveSvgAsPng2');}, 100);
      });
      savePngPromise2.then(function (value) {
        $("#loader").hide();
        $("#overlay").hide();
      });
    });
  });
};
  
/*
 * This function checks if the map should get re-render or skiped based on the multi dropdown selections
 * @param  globalSelectorValue - The global selector value stored on the bootstrap-multiselect.js before triggering the 'onchange'
 * @param  currentSelectorValue - The current selected value
 * @return skipRender - Boolean
 */
function checkSkipRender(globalSelectorValue, currentSelectorValue) {
  var skipRender = false;
  skipRender = globalSelectorValue === null && (currentSelectorValue === null || currentSelectorValue === 'None Selected');
  if (globalSelectorValue !== null && currentSelectorValue !== null) {
    if (globalSelectorValue.length === currentSelectorValue.length) {
      var temp = [];
      for (var i in currentSelectorValue) {
        if(globalSelectorValue.indexOf(currentSelectorValue[i]) === -1) temp.push(currentSelectorValue[i]);
      }
      for(i in globalSelectorValue) {
        if(currentSelectorValue.indexOf(globalSelectorValue[i]) === -1) temp.push(globalSelectorValue[i]);
      }
      temp.sort();
      skipRender = (temp.length === 0);
    }
  }
  return skipRender;
}

/*
 * This function creates a dropdown option using jquery - bootstrap libraries.
 * @param  selector - The selector element that is going to be configured
 * @param  selectorOptions - The dropdown list that the selector is going to contain
 */
function loadSelector(selector, selectorOptions) {
  var arr = [];
  var label = (selector === 'carrier') ? 'Carrier' : (selector === 'hub') ? 'Hub' : (selector === 'state') ? 'State' :  (selector === 'city') ? 'City' : selector.toUpperCase();
  label += ':';
  if (selector === 'state') {
    for (var row in selectorOptions) {
      arr.push(selectorOptions[row]);
    }
  } else {
    for (var row in selectorOptions) {
      var dataValue = (selector === 'carrier') ? selectorOptions[row].Carrier : selectorOptions[row][selector.toUpperCase()];
      if (typeof dataValue !== 'undefined') {
        if (arr.indexOf(dataValue) < 0) {
          arr.push(dataValue);
        }
      }
    }
  }

  if (typeof arr === 'number') {
    arr.sort(function (a, b) {return a - b;});
  } else {
    arr.sort();
  }

  if (selector !== 'bu') {
    d3.select('#mainSelectors').append('label').text(label).attr('id', selector + 'Label').attr('style', 'padding:2px')
    var selectElement = d3.select('#mainSelectors').append('select')
                          .attr('class', 'select').attr('id', selector).attr('name', selector).attr('multiple', 'multiple');
    var options = selectElement.selectAll('option').data(arr).enter().append('option').text(function (d) {return d;});
  } else {
    var marginLeft = (selector === 'bu')? ';margin-left:0px' : '';
    d3.select('#mainSelectors').append('label').text(label).attr('id', selector + 'Label').attr('style', 'padding:2px' + marginLeft)
    
    var selectElement = d3.select('#mainSelectors').append('select')
                          .attr('class', 'select').attr('id', selector).attr('name', selector);
    var options = selectElement.selectAll('option')
                               .data(['None Selected'].concat(arr)).enter()
                               .append('option').text(function (d) {return d;});
  }

  window.prettyPrint() && prettyPrint();
  $('#' + selector).multiselect({
    buttonClass: 'btn btn-default btn-sm',
    buttonWidth: (selector === 'fc' || selector === 'hub') ? '140px' : '105px',
    includeSelectAllOption: (selector !== 'bu'),
    enableFiltering: (selector !== 'bu'),
    maxHeight: 300
  });
}

/*
 * This function is used to render the main visualization map and filter the dropdown selectors
 * Using Promise to display the 'loading' spin and overlay first, then render the map
 * and finally hide to 'loading' spin when it finishes.
 * @param  selectorOptions - The current options from the list
 * @param  selector - The selector element triggering the 'render'
 */
function reRenderMap(selectorOptions,selector) {
  var selectorPromise = new Promise(function(resolve, reject) {
    $("#loader").show();
    $("#overlay").show();
    setTimeout(function() {resolve('renderMap');}, 100);
  });
  selectorPromise.then(function(value) {
    filterSelectors(selectorOptions, selector);
    filteredData = getFilteredData();
    // Since Hub and State dropdowns are multiselect, we need to make sure they
    // actually have something selected in order to render map.
    if (selector.id !== 'bu') {
      if (filteredData.length>0) {renderMap();};
    } else {
      renderMap();
    }
    $("#loader").hide();
    $("#overlay").hide();
  });
}

/*
 * This function is used to filter the dropdown data once a selection from any dropdown has been made
 * Using a jquery library called 'linq' in oreder to perform the query type filter.
 * @param  selectorOptions - The current options from the list
 * @param  selectorElement - The selector element triggering the 'filter'
 */
function filterSelectors(selectorOptions, selectorElement) {
  if (selectorElement.id === 'bu') {
    $('#fc').val(null);
    $('#hub').val(null);
    $('#carrier').val(null);
  }
  
  var bu = $('#bu').val();
  var fc = $('#fc').val();
  var hub = $('#hub').val();
  var carrier = $('#carrier').val();
  var fData = [];

  if (bu !== 'None Selected') {
    var fData = Enumerable.from(selectorOptions).where(function (x) {
      return x.BU === bu;
    }).toArray();
    if (fc !== null || hub !== null || carrier !== null) {
      fData = Enumerable.from(fData).where(
        function (x) {
          if (fc !== null && hub === null && carrier === null) {
            return (x.FC !== null && fc.indexOf(x.FC.toString()) > -1);
          }
          if (fc === null && hub !== null && carrier === null) {
            return (hub.indexOf(x.HUB.toString()) > -1);
          }
          if (fc === null && hub === null && carrier !== null) {
            return (carrier.indexOf(x.Carrier.toString()) > -1);
          }
          if (fc !== null && hub !== null && carrier === null) {
            return (x.FC !== null && fc.indexOf(x.FC.toString()) > -1) && (hub.indexOf(x.HUB.toString()) > -1);
          }
          if (fc !== null && hub === null && carrier !== null) {
            return (x.FC !== null && fc.indexOf(x.FC.toString()) > -1) && (carrier.indexOf(x.Carrier.toString()) > -1);
          }
          if (fc === null && hub !== null && carrier !== null) {
            return (hub.indexOf(x.HUB.toString()) > -1) && (carrier.indexOf(x.Carrier.toString()) > -1);
          }
          if (fc !== null && hub !== null && carrier !== null) {
            return (x.FC !== null && fc.indexOf(x.FC.toString()) > -1) && (hub.indexOf(x.HUB.toString()) > -1) && (carrier.indexOf(x.Carrier.toString()) > -1);
          }
        }
      ).toArray();
    }
  }
  
  reloadSelector('fc',fData,selectorElement.id);
  reloadSelector('hub',fData,selectorElement.id);
  reloadSelector('carrier',fData,selectorElement.id);

}

/*
 * This function is used to refresh the dropdown options once the 'onchange'
 * of another button has been triggered.
 * @param  selector - The selector element that is going to be refreshed
 * @param  filteredSelectorData - The 'filtered' dropdown list that the selector is going to contain
 * @param triggerSelector - The selector element triggering the 'refresh'
 */
function reloadSelector(selector,filteredSelectorData,triggerSelector) {
  var currentValue = $('#'+selector).val(); 
  // Going to use the filteredSelectorData to generate a new 'clean' array with the options
  var arr = [];
  for (var row in filteredSelectorData) {
    var dataValue = (selector === 'carrier') ? filteredSelectorData[row].Carrier : filteredSelectorData[row][selector.toUpperCase()];
    if (typeof dataValue !== 'undefined') {
      // Check if it has been already placed in the array to avoid duplicates
      if (arr.indexOf(dataValue)<0) {
        arr.push(dataValue);
      }
    }
  }
  arr = (selector === 'city') ? filteredSelectorData : arr;
  
  // Sort the option list
  if (typeof arr === 'number') {
    arr.sort(function(a,b){return a - b;});
  } else {
    arr.sort();
  }
  
  // Going to generate the structure for the selector option list
  // The options[] array needs to contain 'label' (display value) and 'value'
  // Note: All "multi-select" selectors have by default the 'None Selected' value
  // so there's no need to add it.
  var options = [];
  if (selector === 'bu') {
    options.push({label:'None Selected',value:'None Selected'});
  }
  for (var item in arr) {
    var fcName = (typeof fcNames.get(arr[item]) === 'undefined') ? '' : fcNames.get(arr[item]);
    var hubName = (typeof hubNames.get(arr[item]) === 'undefined') ? '' : hubNames.get(arr[item]);
    if (selector === 'fc' || selector === 'hub') {
      options.push({label: arr[item] + ' - ' + ((selector === 'fc') ? fcName : hubName), value: arr[item]});
    } else {
      options.push({label: arr[item], value: arr[item]});
    }
  }
  // Use the bootstrap library - 'dataprovider' to send the new list
  $('#'+selector).multiselect('dataprovider', options);
  
  // With the new data passed to the dropdown, the previously selected values are not retained
  // Need to select them 'manually' by configuring the correct class names and checkboxes
  if (selector !== 'bu') {
    var selectorOptions = $('#'+selector).next().children('ul').children('li');
    for (var opt = 0; opt<selectorOptions.length; opt++) {
      var nextOpt = selectorOptions[opt];
      var nextOptInput = nextOpt.children[0].children[0].children;
      if (currentValue !== null) {
        if (currentValue.indexOf(nextOptInput[0].value) !== -1) {
          nextOpt.className = "active";
          nextOptInput[0].checked = true;
          $('#'+selector)[0].options[opt].selected = true;
        }
      }
    }
  }

  // Finally, use the bootstrap library - 'dataprovider' to refresh the multiselect
  $('#'+selector).multiselect('refresh');
}

/*
 * This function is used to filter the map data once a selection from any dropdown has been made
 * Using the current selected values for all the dropdowns. 
 * Using a jquery library called 'linq' in oreder to perform the query type filter.
 * @returns Array with the filtered information
 */
function getFilteredData() {
  var bu = $('#bu').val();
  var fc = $('#fc').val();
  var hub = $('#hub').val();
  var carrier = $('#carrier').val();
  var fData = [];

  if (bu !== 'None Selected') {
    var fData = Enumerable.from(zipSourceData).where(function (x) {return x.BU === bu;}).toArray();
    
    for (var row in fData) {
      overallZipVolume.set(fData[row].Zipcode,fData[row].Volume)
    }
    
    if (fc !== null || hub !== null || carrier !== null) {
      fData = Enumerable.from(fData).where(
        function (x) {
          if (fc !== null && hub === null && carrier === null) {
            return (x.FC !== null && fc.indexOf(x.FC.toString()) > -1);
          }
          if (fc === null && hub !== null && carrier === null) {
            return (hub.indexOf(x.HUB.toString()) > -1);
          }
          if (fc === null && hub === null && carrier !== null) {
            return (carrier.indexOf(x.Carrier.toString()) > -1);
          }
          if (fc !== null && hub !== null && carrier === null) {
            return (x.FC !== null && fc.indexOf(x.FC.toString()) > -1) && (hub.indexOf(x.HUB.toString()) > -1);
          }
          if (fc !== null && hub === null && carrier !== null) {
            return (x.FC !== null && fc.indexOf(x.FC.toString()) > -1) && (carrier.indexOf(x.Carrier.toString()) > -1);
          }
          if (fc === null && hub !== null && carrier !== null) {
            return (hub.indexOf(x.HUB.toString()) > -1) && (carrier.indexOf(x.Carrier.toString()) > -1);
          }
          if (fc !== null && hub !== null && carrier !== null) {
            return (x.FC !== null && fc.indexOf(x.FC.toString()) > -1) && (hub.indexOf(x.HUB.toString()) > -1) && (carrier.indexOf(x.Carrier.toString()) > -1);
          }
        }
      ).toArray();
    }
  }
  
  return fData;
}

/*
 * Asynchronous tasks, load topojson maps and data
 */
d3.queue()
  .defer(d3.json, "js/data/topo_zipcodes.json")
  .defer(d3.json, "js/data/topo_roads.json")
  .defer(d3.json, "js/data/features_states.json")
  .defer(d3.json, "js/data/footprint_data.json")
  .defer(d3.json, "js/data/geocode_fc.json")
  .defer(d3.json, "js/data/geocode_hub.json")
  .defer(d3.json, "js/data/temp_zipToCity.json")
  .await(ready);
  
/*
 * Callback function for d3.queue()
 */
function ready(error, topoZipcodes, topoRoads, featureStates, footprintData, geocodeFc, geocodeHub, zipCity) {
  if (error) throw error;
  
  // Loading data into global variables
  zipSourceData = footprintData;
  fcGeocode = geocodeFc;
  hubGeocode = geocodeHub;
  for (var row in fcGeocode) {fcNames.set(fcGeocode[row].FCNum,fcGeocode[row].FCName);}
  for (var row in hubGeocode) {hubNames.set(hubGeocode[row].HubNumber,hubGeocode[row].HubName);}
  
  // Creating SVG variables
  const map = d3.select("#map");
  const zoom = d3.zoom()
                 .scaleExtent([1, 40])
                 .translateExtent([[0,0], [width, height]])
                 .extent([[0, 0], [width, height]])
                 .on("zoom", zoomed);
  
  const svg = map.append("svg")
                 .attr("width", width).attr("height", height).attr("class", "map")
                 .call(zoom);
  
  // Creating multiple 'layers' for Zipcodes, States and Route
  const g = svg.append("g").attr("id", "zipcodeLayer");
  const g1 = svg.append("g").attr("id", "stateLayer");
  const g2 = svg.append("g").attr("id", "routeLayer");
  
  // Function used for the zoom-in and zoom-out events
  function zoomed(){
    g.attr("transform", d3.event.transform);
    // TODO: Enable layers and routes
    g1.attr("transform", d3.event.transform);
    g2.attr("transform", d3.event.transform);
  }
  
  // Topojson-feature collection with zipcodes used as the main projection/geoPath
  us_zipcodes = topojson.feature(topoZipcodes, {
      type: "GeometryCollection",
      geometries: topoZipcodes.objects.zip_poly.geometries
  });

  // Initializing the global projection and geoPath variables
  projection = d3.geoAlbersUsa().fitSize([width, height], us_zipcodes);
  geoPath = d3.geoPath().projection(projection);
  
  // Topojson-feature collection with US-routes used to display the routes on the map
  // TODO: check for a 'ligther' json file version with only the features instead of the full topo
  us_roads = topojson.feature(topoRoads, {
      type: "GeometryCollection",
      geometries: topoRoads.objects.tl_2016_us_primaryroads.geometries
  });
  
  // Draw map and Bind zip data
  g.selectAll("path")
    .data(us_zipcodes.features).enter().append("path")
    .attr("d", geoPath).attr("fill", "lightgray").attr("class", "zipcodes");
  
  // Draw map and Bind State data
  g1.selectAll("path")
    .data(featureStates.features).enter().append("path")
    .attr("d", geoPath).attr("fill", "none").attr("opacity", "1")
    .style("stroke", "black").style("stroke-width", ".2");
    
  // Draw map and Bind US-Routes data
  g2.selectAll("path")
    .data(us_roads.features).enter().append("path")
    .attr("d", geoPath).attr("fill", "none").attr("opacity", ".8")
    .style("stroke", "white").style("stroke-width", ".4")
    .append("title")
    .classed("tooltip", true)
    .text(function(d) {return d.properties.FULLNAME;});
    
 
  $("#loader").hide();
  $("#overlay").hide();
  
  // TODO: Enable City
  // The next chunk of code generates a D3 hashmap with MA and Cities using the temp_zipToCity.json
  zipCityData = zipCity;
  for (var row in zipCityData) {
    var state = zipCityData[row][0];
    var city = zipCityData[row][1];
    if (city !== '') {
      city = city.split(',')[0].trim();
      var tempArr = stateCities.get(state)
      if (typeof tempArr === 'undefined') {
        tempArr = [city];
        stateCities.set(state,tempArr);
      } else {
        if (tempArr.indexOf(city) < 0) {
          tempArr.push(city);
        }
        stateCities.set(state,tempArr);
      }    
    }
  }
}

/*
 * This function is used to 'render' the map. It retrieves all necessary collections
 * Then calculates the corresponding values (color, opacity, tooltip) for each zipcode
 * An important function used inside this function is 'getMapColor'
 */
function renderMap() {
  displayLocation();
  zipVolumeCollection = getZipCollection('Volume');
  zipCarrierCollection = getZipCollection('Carrier');
  zipFCCollection = getZipCollection('FC');
  zipHubCollection = getZipCollection('HUB');

  d3.select("svg.map").select("g").selectAll("path")
    .transition().duration(0)
    .delay(function(d,i) {return 0;})
    .ease(d3.easeLinear)
    .attr("fill", function(d) {
      mapColorArr = getMapColor(d);
      var currentZip3 = parseInt(d.properties.ZIP.toString().substring(0,3));
      var zip3Condition = currentZip3>=minZip3 && currentZip3<=maxZip3;
      var stateCondition = selectedState.indexOf(d.properties.STATE) !== -1 || selectedState === 'None Selected';
      // TODO: Enable City
      var tempCity = (typeof zipCityData[d.properties.ZIP] !== 'undefined') ? zipCityData[d.properties.ZIP][1] : '';
      tempCity = tempCity.split(',')[0].trim();
      var cityCondition = selectedCity.indexOf(tempCity) !== -1 || selectedCity === 'None Selected';
      var fillColor = (stateCondition && zip3Condition && cityCondition) ? mapColorArr[0] : 'lightgray';
      return fillColor;
    })
    .attr("opacity", function(d) {
      mapColorArr = zipMapColor.get(d.properties.ZIP);
      var currentZip3 = parseInt(d.properties.ZIP.toString().substring(0,3));
      var zip3Condition = currentZip3>=minZip3 && currentZip3<=maxZip3;
      var stateCondition = selectedState.indexOf(d.properties.STATE) !== -1 || selectedState === 'None Selected';
      // TODO: Enable City
      var tempCity = (typeof zipCityData[d.properties.ZIP] !== 'undefined') ? zipCityData[d.properties.ZIP][1] : '';
      tempCity = tempCity.split(',')[0].trim();
      var cityCondition = selectedCity.indexOf(tempCity) !== -1 || selectedCity === 'None Selected';
      var colorValue = (stateCondition && zip3Condition && cityCondition) ? mapColorArr[1] : -1;
      if (colorValue == -1 || colorValue >= volumeThreshold || mapColorArr[0] === 'lightgray') { return 1;}
      transValue = 10 - Math.exp(-colorValue*.2)*9;
      scaledValue = (1-.4)*(transValue-0)/(volumeThreshold - 0) + .4;
      return scaledValue
    })
  // Tooltip
  if (!tooltipSet) {
    d3.select("svg.map").select("g").selectAll("path")
      .append("title")
      .classed("tooltip", true)
      .text(function(d) {
        var currentZip3 = parseInt(d.properties.ZIP.toString().substring(0,3));
        var zip3Condition = currentZip3>=minZip3 && currentZip3<=maxZip3;
        var stateCondition = selectedState.indexOf(d.properties.STATE) !== -1 || selectedState === 'None Selected';
        // TODO: Enable City
        var tempCity = (typeof zipCityData[d.properties.ZIP] !== 'undefined') ? zipCityData[d.properties.ZIP][1] : '';
        tempCity = tempCity.split(',')[0].trim();
        var cityCondition = selectedCity.indexOf(tempCity) !== -1 || selectedCity === 'None Selected';
        var tooltip = (stateCondition && zip3Condition && cityCondition) ? zipMapColor.get(d.properties.ZIP)[2] : '';
        return tooltip;
      });
    tooltipSet = true;
  } else {
    d3.select("svg.map").select("g").selectAll("path")
      .select("title")
      .text(function(d) {
        var currentZip3 = parseInt(d.properties.ZIP.toString().substring(0,3));
        var zip3Condition = currentZip3>=minZip3 && currentZip3<=maxZip3;
        var stateCondition = selectedState.indexOf(d.properties.STATE) !== -1 || selectedState === 'None Selected';
        // TODO: Enable City
        var tempCity = (typeof zipCityData[d.properties.ZIP] !== 'undefined') ? zipCityData[d.properties.ZIP][1] : '';
        tempCity = tempCity.split(',')[0].trim();
        var cityCondition = selectedCity.indexOf(tempCity) !== -1 || selectedCity === 'None Selected';
        var tooltip = (stateCondition && zip3Condition && cityCondition) ? zipMapColor.get(d.properties.ZIP)[2] : '';
        return tooltip;
      }); 
  }
}

/*
 * This function is used get each zipcode data, such as Volume, Carrier, FC, Hub, Color
 */
function getMapColor(d) {
  var colorValue = "lightgray";
  var zipVolume = getZipCollectionValue(d,'Volume');
  var zipCarrier = getZipCollectionValue(d,'Carrier');
  var zipFC = getZipCollectionValue(d,'FC');
  var zipHub = getZipCollectionValue(d,'HUB');
  var fcName = (typeof fcNames.get(zipFC) === 'undefined') ? '' : fcNames.get(zipFC);
  var hubName = (typeof hubNames.get(zipHub) === 'undefined') ? '' : hubNames.get(zipHub);
    
  switch (zipCarrier) {
    case 'COU': colorValue = '#008856'; break;
    case 'FedEx': colorValue = '#875692'; break;
    case 'Fleet': colorValue = '#654522'; break;
    case 'USPS': colorValue = '#0067A5'; break;
    case 'UPS': colorValue = '#BE0032'; break;
    default: colorValue = 'lightgray'; break;
  }

  var tooltipLabel = "City/Town: " + d.properties.PO_NAME + ", " +d.properties.STATE + "\n" + "Zipcode: " + d.properties.ZIP + " \nFC: " + zipFC + " - " + fcName + " \nHub: " + zipHub + " - " + hubName + " \nCarrier: " + zipCarrier + " \nDaily Volume: " + zipVolume ;
  
  zipVolume = (colorValue === 'lightgray') ? -1 : zipVolume;
  tooltipLabel = (colorValue === 'lightgray') ? '' : tooltipLabel;
  
  if (filteredMaxVol !== volumeThreshold) {
    if (zipVolume > filteredMaxVol || zipVolume < filteredMinVol) {
      zipVolume = -1;
      tooltipLabel = '';
      colorValue = 'lightgray';
    }
  } else {
    if (zipVolume < filteredMinVol) {
      zipVolume = -1;
      tooltipLabel = '';
      colorValue = 'lightgray';
    }
  }
  //if (colorValue === 'lightgray') {console.log(d.properties.ZIP)}
  zipMapColor.set(d.properties.ZIP,[colorValue,zipVolume,tooltipLabel]);
  return [colorValue,zipVolume,tooltipLabel];
}

/*
 * This function is used get the zipcode value for different type of 'collections'
 * @param d - The zipcode array
 * @param collectionType - The collection type to retrieve value (Volume, Carrier, FC, HUB)
 * @returns {Number|String} finalValue
 */
function getZipCollectionValue(d,collectionType) {
  var finalValue;
  var mapZip = d.properties.ZIP;
  var backupZipcode = overallZipVolume.get(mapZip);
  if (collectionType === 'Volume') {
    var value = zipVolumeCollection.get(mapZip);
    value = (typeof value === 'undefined') && (typeof backupZipcode === 'undefined') ? zipVolumeCollection.get(mapZip.substring(0,3)) : value;
    value = (typeof value === 'undefined') ? 0 : value;
    finalValue = parseFloat(value).toFixed(2);
  }
  if (collectionType === 'Carrier') {
    var value = zipCarrierCollection.get(mapZip);
    value = (typeof value === 'undefined') && (typeof backupZipcode === 'undefined') ? zipCarrierCollection.get(mapZip.substring(0,3)) : value;
    value = (typeof value === 'undefined') ? 'NA' : value;
    finalValue = value;
  }
  if (collectionType === 'FC') {
    var value = zipFCCollection.get(mapZip);
    value = (typeof value === 'undefined') && (typeof backupZipcode === 'undefined') ? zipFCCollection.get(mapZip.substring(0,3)) : value;
    value = (typeof value === 'undefined') ? 'NA' : value;
    finalValue = value;      
  }
  if (collectionType === 'HUB') {
    var value = zipHubCollection.get(mapZip);
    value = (typeof value === 'undefined') && (typeof backupZipcode === 'undefined') ? zipHubCollection.get(mapZip.substring(0,3)) : value;
    value = (typeof value === 'undefined') ? 'NA' : value;
    finalValue = value;      
  }
  return finalValue;
}

/*
 * Function used to generate a collection map in the form of {zipcode: value}
 * That collection map will be used for the visualization map tooltips and colors.
 * Options are: Volume, Carrier, FC, HUB
 * @param collectionType - The type of data to retrieve from the 'filteredData'
 * @returns {d3.map}
 */
function getZipCollection(collectionType) {
  var zipVolumeData = d3.map();
  for (var row in filteredData) {
    zipVolumeData.set(filteredData[row].Zipcode,filteredData[row][collectionType]);
  }
  return zipVolumeData;
}

/*
 * This function is used to display the FC and Hub markers on the map
 */
function displayLocation() {
  var newHubGeo = [];
  var newfcGeo = [];
  if (typeof filteredData !== 'undefined' && filteredData.length!=0) {
    fcHubData = Enumerable.from(filteredData).where(function (x) { return parseInt(String(x.Zipcode).substring(0, 3), 10)>= minZip3 }).toArray();
    fcHubData = Enumerable.from(fcHubData).where(function (x) { return parseInt(String(x.Zipcode).substring(0, 3), 10) <= maxZip3 }).toArray();
    var hubMap = d3.map();
    var fcMap = d3.map();
    for (var row in fcHubData) {
      hubMap.set(fcHubData[row].HUB,0);
      fcMap.set(fcHubData[row].FC,0);
    }
    for (var row in hubGeocode) {
      if (typeof hubMap.get(parseInt(hubGeocode[row].HubNumber)) !== 'undefined') {
        if (selectedState.indexOf(hubGeocode[row].State) !== -1 || selectedState === 'None Selected') {
          newHubGeo.push(hubGeocode[row]);
        }
      }			
    }
    for (var row in fcGeocode) {
      if (typeof fcMap.get(parseInt(fcGeocode[row].FCNum)) !== 'undefined') {
        if (selectedState.indexOf(fcGeocode[row].State) !== -1 || selectedState === 'None Selected') {
          newfcGeo.push(fcGeocode[row]);
        }
      }
    }
  } else {
    newHubGeo = hubGeocode
    newfcGeo = fcGeocode
  }

  displayValue = $('input[name=displayLocation]:checked').val();
  d3.select("#routeLayer").selectAll("circle").remove();
  d3.select("#routeLayer").selectAll("image").remove();
  if (displayValue === 'hub' || displayValue === 'both') {
    // add stars to svg
    d3.select("#routeLayer").selectAll(".hubMark")
      .data(newHubGeo).enter().append("svg:image")
      .attr('class','mark').attr('width', 8).attr('height', 8).attr("xlink:href", "css/star.png")
      .attr("transform", function (d) { if(d.Coordinates[1]==0){return "translate(-100)"}; return "translate(" + projection([d.Coordinates[1],d.Coordinates[0]]) + ")"; })
      .append("svg:title").text(function(d, i) { if(d.Coordinates[1]==0){return ""}; return 'Hub: ' + d["HubNumber"]; });
  }
  if (displayValue === 'fc' || displayValue === 'both') {
    // add circles to svg
    d3.select("#routeLayer").selectAll(".fcMark")
      .data(newfcGeo).enter().append("svg:image")
      .attr('class','mark').attr('width', 6).attr('height', 6).attr("xlink:href", "css/dot.png")
      .attr("transform", function (d) { if(d.Coordinates[1]==0){return "translate(-100)"}; return "translate(" + projection([d.Coordinates[1],d.Coordinates[0]]) + ")"; })
      .append("svg:title").text(function(d, i) { if(d.Coordinates[1]==0){return ""}; return 'FC: ' + d["FCNum"]; });
  }
}


/*
 * Function that handles the values for the zip volume slider-range object (top side of map) 
 * @param  ui
 */
function handleZipvolume(ui) {
  filteredMinVol = ui.values[0];
  filteredMaxVol = ui.values[1];
  //filteredData = getFilteredData();
  var selectorPromise = new Promise(function(resolve, reject) {
    $("#loader").show();
    $("#overlay").show();
    setTimeout(function() {resolve('renderMap');}, 100);
  });
  selectorPromise.then(function(value) {
    renderMap();
    $("#loader").hide();
    $("#overlay").hide();
  });
}

/*
 * Function that handles the values for the Zip3 slider-range object (right side of map) 
 * @param  ui
 */
function handleZip3(ui) {
  minZip3 = ui.values[0];
  maxZip3 = ui.values[1];
  var selectorPromise = new Promise(function(resolve, reject) {
    $("#loader").show();
    $("#overlay").show();
    setTimeout(function() {resolve('renderMap');}, 100);
  });
  selectorPromise.then(function(value) {
    renderMap();
    $("#loader").hide();
    $("#overlay").hide();
  });
}

/*
 * Function that initialize the slider-range for the 'Daily Volume'
 */
$(function() {
  var minVal = 0;
  var maxVal = volumeThreshold;
  $("#slider-range").slider({
    range: true,
    min: minVal,
    max: maxVal,
    values: [ minVal, maxVal ],
    slide: function(event, ui) {
      if (ui.values[1] === volumeThreshold) {
        $("#volume").val(ui.values[0] + " - " + ui.values[1] + "+");
      } else {
        $("#volume").val(ui.values[0] + " - " + ui.values[1]);
      }
    },
    stop: function( event, ui ) {handleZipvolume(ui)}
  });
  $("#volume").val($("#slider-range").slider("values", 0) + " - " + $("#slider-range").slider("values", 1) + "+");
  
  var volumeInput = document.getElementById('volume');
  volumeInput.size = (maxVal|0).toString().length + (maxVal|0).toString().length;
});

/*
 * Function that initialize the slider-range-vertical for the 'Zip3' delimitator
 */
$(function() {
  $("#slider-range-vertical").slider({
    orientation: "vertical",
    range: true,
    min: 1,
    max: 999,
    values: [ minZip3, maxZip3 ],
    slide: function( event, ui ) {
      var minStr = ui.values[0]+"";
      while (minStr.length < 3) minStr = "0" + minStr;
      var maxStr = ui.values[1]+"";
      while (maxStr.length < 3) maxStr = "0" + maxStr;
      $("#zip3min").val(minStr);
      $("#zip3max").val(maxStr);
    },
    stop: function( event, ui ) {handleZip3(ui)}
  });
  var minStr = $("#slider-range-vertical").slider("values", 0)+"";
  while (minStr.length < 3) minStr = "0" + minStr;
  var maxStr = $("#slider-range-vertical").slider("values", 1)+"";
  while (maxStr.length < 3) maxStr = "0" + maxStr;  
  $("#zip3min").val(minStr);
  $("#zip3max").val(maxStr);
});

/*
 * Function that updates the zip slider-range-vertical, once the users 'manually' inputs a zip3 value on the textbox
 */
function updateZipRange(zipValue,upperValue) {
  if (upperValue) {
    upperValue = zipValue;
    lowerValue = minZip3;
  } else {
    upperValue = maxZip3;
    lowerValue = zipValue;
  }
  if (lowerValue > upperValue) {
    temp = lowerValue;
    lowerValue = upperValue;
    upperValue = temp;
  }
  $("#slider-range-vertical").slider({
    orientation: "vertical",
    range: true,
    min: 1,
    max: 999,
    values: [ lowerValue, upperValue ],
    slide: function( event, ui ) {
      var minStr = ui.values[0]+"";
      while (minStr.length < 3) minStr = "0" + minStr;
      var maxStr = ui.values[1]+"";
      while (maxStr.length < 3) maxStr = "0" + maxStr;
      $("#zip3min").val(minStr);
      $("#zip3max").val(maxStr);
    },
    stop: function( event, ui ) {handleZip3(ui)}
  });
  var minStr = $("#slider-range-vertical").slider("values", 0)+"";
  while (minStr.length < 3) minStr = "0" + minStr;
  var maxStr = $("#slider-range-vertical").slider("values", 1)+"";
  while (maxStr.length < 3) maxStr = "0" + maxStr;  
  $("#zip3min").val(minStr);
  $("#zip3max").val(maxStr);
  
  minZip3 = lowerValue;
  maxZip3 = upperValue;
  renderMap();
}


/*
 * Function used to enabled the 'US Route toggle' 
 */
var showRoutes = true;
function routeToggle() {
  showRoutes = !showRoutes;
  if (showRoutes) {
    var togglePromise = new Promise(function(resolve, reject) {
      $("#loader").show();
      $("#overlay").show();
      setTimeout(function() {resolve('toggleRoutes');}, 100);
    });
    togglePromise.then(function(value) {
      d3.select("#routeLayer").selectAll("path")
        .data(us_roads.features).enter().append("path")
        .attr("d", geoPath).attr("fill", "none").attr("opacity", ".8")
        .style("stroke", "white").style("stroke-width", ".4")
        .append("title")
        .classed("tooltip", true)
        .text(function(d) {return d.properties.FULLNAME;});
      $("#loader").hide();
      $("#overlay").hide();
    });
  } else {
    d3.select("#routeLayer").selectAll("path").remove();
  }
}



// Another alternative to the save as
// The next chunk should go under -> d3.select('#saveButton').on('click')
/* 
var svg = d3.select('svg');
var svgString = getSVGString(svg.node());
svgString2Image(svgString, 2 * width, 2 * height, 'png', save); // passes Blob and filesize String to the callback
function save(dataBlob, filesize) {
  saveAs(dataBlob, 'deliveryFootprint.png'); // FileSaver.js function
}
*/

// Another alternative to the save as 
/*
// Below are the functions that handle actual exporting:
// getSVGString ( svgNode ) and svgString2Image( svgString, width, height, format, callback )
  function getSVGString(svgNode) {
    svgNode.setAttribute('xlink', 'http://www.w3.org/1999/xlink');
    var serializer = new XMLSerializer();
    var svgString = serializer.serializeToString(svgNode);
    svgString = svgString.replace(/(\w+)?:?xlink=/g, 'xmlns:xlink='); // Fix root xlink without namespace
    svgString = svgString.replace(/NS\d+:href/g, 'xlink:href'); // Safari NS namespace fix
    return svgString;
  }
  
  function svgString2Image(svgString, width, height, format, callback) {
    var format = format ? format : 'png';
    var imgsrc = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString))); // Convert SVG string to data URL
    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d");
    
    canvas.width = width;
    canvas.height = height;
    
    var image = new Image();
    image.onload = function () {
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(function (blob) {
        var filesize = Math.round(blob.length / 1024) + ' KB';
        if (callback)
          callback(blob, filesize);
      });
    };
    image.src = imgsrc;
  }
*/