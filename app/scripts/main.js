(function() {

  'use strict';

  /*global $, google, Highcharts */

  // Global configuration
  const CONFIG = {
    // API Keys
    dataAPIKey: 'Ay2xaPeusXZX9l9tRIvIHnZSjW4RZ6RGP7lJIsMn',

    // Configurations for the map
    defaultLatitude: 37.445941,
    defaultLongitude: -122.1655,
    defaultMapZoom: 18,

    // Default metrics configuration
    defaultWattagePerSqM: 222,
    defaultUtilityRate: 0.14,

    // Configurations for the solar panel
    solarPanelName: 'SunPower X21-335-BLK',
    solarPanelPower: 0.335,
    solarPanelArea: 1.558 * 1.036, // in SqM
    solarPanelUnitPrice: 3.5,

    // Common configurations for HighCharts
    defaultChartConfig: {
      chart: {
        type: 'column',
        height: 350,
        backgroundColor: '#fafafa',
        plotBackgroundColor: '#fafafa'
      },
      xAxis: {
        type: 'category'
      },
      credits: {
        enabled: false
      },
      legend: {
        enabled: false
      }
    }
  };

  var counter = 0; // Keep track of the number of roofs
  var map, drawingManager;
  var roofs = []; // Keep track of info about the roofs

  function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
      center: {lat: CONFIG.defaultLatitude, lng: CONFIG.defaultLongitude},
      zoom: CONFIG.defaultMapZoom
    });

    drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: ['polygon']
      }
    });
    drawingManager.setMap(map);
  }

  function addRoofFace(lat, lng, area) {
    // Template for each roof item
    var singleRoofTemp = `
      <div id="roof_${counter}" class="list-group-item">
        <h4 class="list-group-item-heading">Roof #${counter + 1}</h4>
        <div class="list-group-item-text single-roof row">
          <div class="form-group col-xs-4">
            <label for="roof_${counter}_tilt">Tilt</label>
            <input type="number" class="form-control roof-tilt" id="roof_${counter}_tilt" data-id="${counter}" min="0" max="90" value="0">
          </div>
          <div class="form-group col-xs-4">
            <label for="roof_${counter}_azi">Azimuth</label>
            <input type="number" class="form-control roof-azimuth" id="roof_${counter}_azi" data-id="${counter}" min="0" max="360" value="0">
          </div>
          <div class="form-group col-xs-4">
            <label for="roof_${counter}_wattage">Watt/m<sup>2</sup></label>
            <input type="number" class="form-control roof-wattage" id="roof_${counter}_wattage" data-id="${counter}" min="0" value="${CONFIG.defaultWattagePerSqM}">
          </div>
          <div class="col-xs-12">
            <button type="submit" class="btn btn-primary btn-block analyze" data-id="${counter}">Analyze</button>
          </div>
        </div>
      </div>
    `;

    // Hide description texts
    $('.tip').hide();

    // Push the roof into the roofs array
    roofs.push({
      id: counter,
      lat: lat,
      lng: lng,
      area: area,
      tilt: 0,
      azimuth: 0,
      wattage: CONFIG.defaultWattagePerSqM,
      panels: Math.floor(area / CONFIG.solarPanelArea)
    });

    $('#roof_faces').append(singleRoofTemp);

    counter++;
  }

  function updateRoof(id, field, value) {
    roofs[id][field] = parseInt(value);
  }

  function calculateSystemSize(id) {
    return parseFloat(roofs[id].area * roofs[id].wattage / 1000).toFixed(2);
  }

  function calculateSystemCost(id) {
    return parseFloat(roofs[id].panels * CONFIG.solarPanelPower * 1000 * CONFIG.solarPanelUnitPrice).toFixed(2);
  }

  function calculateAnnualSavings(id, unitPrice) {
    return parseFloat(roofs[id].performanceMetrics.ac_annual * (unitPrice || CONFIG.defaultUtilityRate)).toFixed(2);
  }

  function updateAnnualSavings(id, unitPrice) {
    $('#annual_savings').text('$ ' + calculateAnnualSavings(id, (unitPrice || CONFIG.defaultUtilityRate)));
  }

  function calculateMonthlyEnergy(monthlyProduction) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var data = [];

    for (var i = 0; i < months.length; i++) {
      data.push({
        name: months[i],
        y: monthlyProduction[i],
        color: '#4abaa9'
      });
    }

    return data;
  }

  function calculateCashFlow(initialCost, annulSaving) {
    // calculate break even point
    var breakEvenYear = Math.floor(initialCost / annulSaving);

    // Get the optimal number of years to draw so we get a somewhat balanced chart
    var years = breakEvenYear < 10 ? 20 : Math.floor(breakEvenYear * 2);

    var cumulativeCashflow = -initialCost;
    var data = [];

    for (var i = 0; i < years; i++) {
      data.push({
        name: 'Year ' + i,
        y: cumulativeCashflow,
        color: cumulativeCashflow < 0 ? '#fcc921' : '#4abaa9'
      });

      cumulativeCashflow += parseInt(annulSaving);
    }

    return data;
  }

  function displayFinancialAnalysis(id) {
    $('#panel_name').text(CONFIG.solarPanelName);
    $('#number_of_panels').text(roofs[id].panels);
    $('#system_size').text(calculateSystemSize(id) + ' kW');
    $('#system_cost').text('$ ' + calculateSystemCost(id));
    $('#annual_production').text(roofs[id].performanceMetrics.ac_annual.toFixed(2) + ' kW');
    $('#utility_rate').data('id', id).val(CONFIG.defaultUtilityRate);
    updateAnnualSavings(id);
  }

  function drawMonthlyEnergyChart(id) {
    var data = calculateMonthlyEnergy(roofs[id].performanceMetrics.ac_monthly);
    var chartOptions = $.extend(true, {}, CONFIG.defaultChartConfig, {
      chart: {
        renderTo: 'monthly_energy_production'
      },
      title: {
        text: 'Monthly Energy Production'
      },
      yAxis: {
        min: 0,
        title: {
          text: 'Monthly Energy Production (kW)'
        }
      },
      tooltip: {
        pointFormatter: function() {
          return 'The energy production is <b>' + parseInt(this.y) + '</b> kW';
        }
      },
      series: [{
        data: data
      }]
    });

    Highcharts.chart(chartOptions);
  }

  function drawCashflowChart(id) {
    var data = calculateCashFlow(calculateSystemCost(id), calculateAnnualSavings(id, $('#utility_rate').val()));
    var chartOptions = $.extend(true, {}, CONFIG.defaultChartConfig, {
      chart: {
        renderTo: 'cash_flow'
      },
      title: {
        text: 'Cumulative Cashflow'
      },
      yAxis: {
        title: {
          text: 'Accumulative Cash Flow ($)'
        }
      },
      tooltip: {
        pointFormatter: function() {
          return 'The culmulative cashflow is $<b>' + parseInt(this.y) + '</b>';
        }
      },
      series: [{
        data: data
      }]
    });

    Highcharts.chart(chartOptions);
  }

  function drawCharts(id) {
    drawMonthlyEnergyChart(id);
    drawCashflowChart(id);
  }

  function displaySavings(id) {
    // Obtain performance metrics either from cache or from the API
    $.ajax({
      method: 'GET',
      url: 'https://developer.nrel.gov/api/pvwatts/v5.json',
      dataType: 'jsonp',
      cache: true, // Enable cache
      data: {
        /*eslint-disable camelcase*/
        format: 'json',
        api_key: CONFIG.dataAPIKey,
        system_capacity: roofs[id].panels * CONFIG.solarPanelPower,
        module_type: 0,
        losses: 0,
        array_type: 0,
        tilt: roofs[id].tilt,
        azimuth: roofs[id].azimuth,
        lat: roofs[id].lat,
        lon: roofs[id].lng
        /*eslint-enable camelcase*/
      }
    }).done((data) => {
      // Cache API outputs
      roofs[id].performanceMetrics = data.outputs;

      // Fill in financial analysis data
      displayFinancialAnalysis(id);

      // Hide drawing tools and display savings tab
      $('#drawing_tool').hide();
      $('#visualizer').show();

      // Draw Charts
      drawCharts(id);
    }).error((error) => { // Always reset buttons
      alert('API error');
    }).always(() => { // Always reset buttons
      $('.analyze').attr('disabled', false).text('Analyze');
    });
  }

  function bindEvents() {
    // Listen to polygon creation events
    google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon) => {
      // For the purpose of the demo, let's use the 1st point to calculate its lat and lng
      addRoofFace(polygon.getPath().getAt(0).lat(),
        polygon.getPath().getAt(0).lng(),
        google.maps.geometry.spherical.computeArea(polygon.getPath()));
    });

    var roofFaces = $('#roof_faces');

    // Show financial analysis when user clicks the analyze button
    roofFaces.on('click', '.analyze', (e) => {
      var $this = $(e.currentTarget);
      $this.attr('disabled', true).text('loading...');
      displaySavings($this.data('id'));
    });

    // Update roof tilt info
    roofFaces.on('input', '.roof-tilt', (e) => {
      var $this = $(e.currentTarget);
      updateRoof($this.data('id'), 'tilt', $this.val());
    });

    // Update roof azimuth info
    roofFaces.on('input', '.roof-azimuth', (e) => {
      var $this = $(e.currentTarget);
      updateRoof($this.data('id'), 'azimuth', $this.val());
    });

    // Update roof wattage per sqm info
    roofFaces.on('input', '.roof-wattage', (e) => {
      var $this = $(e.currentTarget);
      updateRoof($this.data('id'), 'wattage', $this.val());
    });

    // Update utility rate and redraw the cash flow chart
    $('#utility_rate').on('input', (e) => {
      var $this = $(e.currentTarget);
      updateAnnualSavings($this.data('id'), $this.val());
      drawCashflowChart($this.data('id'));
    });

    // Bind event for the go back button
    $('#back').on('click', () => {
      $('#visualizer').hide();
      $('#drawing_tool').show();
    });
  }

  // Initialize the app
  function init() {
    initMap();
    bindEvents();

    $('#visualizer').hide();
  }

  init();
})();
