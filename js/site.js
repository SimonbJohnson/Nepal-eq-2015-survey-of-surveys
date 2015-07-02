function sheetLoaded(sheetData){

    console.log(sheetData);
    initDashboard(sheetData.feed.entry);
}

function initDashboard(data){
    var months = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec',"No Date"];
    var hxlSet = hxlate(data);
    var sectorList=getSectors(hxlSet);
    var data = hxlToCF(hxlSet,sectorList,months);
    var cf = crossfilter(data);

    var color = '#056CB6';

    function reduceAdd(p, v) {
        v.sector.forEach (function(val, idx) {
            p[val] = (p[val] || 0) + 1; //increment counts
        });
        return p;
    }
    
    function reduceRemove(p, v) {
         v.sector.forEach (function(val, idx) {
            p[val] = (p[val] || 0) - 1; //decrement counts
        });
        return p;
    }
    
    function reduceInitial() {
           return {};  
    }

    var monthChart = dc.barChart('#monthChart');
    var sectorChart = dc.rowChart('#sectorChart');
    var mapChart = dc.leafletChoroplethChart('#mapChart');

    var monthDimension = cf.dimension(function(d){return d['date+week'];});
    var monthGroup = monthDimension.group();

    var sectorDimension = cf.dimension(function(d){ return d.sector;});
    var sectorGroup = sectorDimension.groupAll().reduce(reduceAdd, reduceRemove, reduceInitial).value();

    var mapDimension = cf.dimension(function(d){ return d['adm3+code']});
    var mapGroup = mapDimension.group();

    var all = cf.groupAll();
        
    sectorGroup.all = function() {
            var newObject = [];
            for (var key in this) {
              if (this.hasOwnProperty(key) && key !== "all") {
                newObject.push({
                  key: key,
                  value: this[key]
                });
              }
            }
            return newObject;
    };

    monthChart.width($('#monthChart').width())
        .height(100)
        .dimension(monthDimension) 
        .group(monthGroup)
        .colors([color])
        .x(d3.scale.linear().domain([0,d3.max(data,function(d){return d['date+week']})]))
        .elasticY(true)
        .yAxis().ticks(3);


    sectorChart.width($('#sectorChart').width())
        .height(510)
        .dimension(sectorDimension) 
        .group(sectorGroup)
            .colors(['#CCCCCC', color])
            .colorDomain([0, 1])
            .colorAccessor(function (d) {
                return 1;
            }) 
        .labelOffsetY(25)
        .elasticX(true)
        .xAxis().ticks(4);

    sectorChart.filterHandler (function (dimension, filters) {
        dimension.filter(null);   
        if (filters.length === 0){
            dimension.filter(null);
        } else {
            dimension.filterFunction(function (d) {
                for (var i=0; i < d.length; i++) {
                    if (filters.indexOf(d[i]) >= 0) return true;
                }
                return false; 
            });
        return filters; 
        }
    });

    var geom = topojson.feature(nepal_adm3,nepal_adm3.objects.nepal_adm3);

    mapChart.width($('#mapChart').width()).height(300)
            .dimension(mapDimension)
            .group(mapGroup)
            .center([27.85,85.1])
            .zoom(8)    
            .geojson(geom)
            .colors(['#DDDDDD','#A7C1D3','#71A5CA','#3B88C0', '#056CB6'])
            .colorDomain([0,4])
            .colorAccessor(function (d) {
                var c =0
                if(d>50){
                    c=4;
                } else if (d>20) {
                    c=3;
                } else if (d>10) {
                    c=2;
                } else if (d>0) {
                    c=1;
                };
                return c
                
            })           
            .featureKeyAccessor(function(feature){
                return feature.properties['HLCIT_CODE'];
            }).popup(function(feature){
                return feature.properties['DISTRICT'];
            })
            .renderPopup(true)
            .featureOptions({
                'fillColor': 'gray',
                'color': 'gray',
                'opacity':0.8,
                'fillOpacity': 0.1,
                'weight': 1
            });

    dc.dataTable("#data-table")
                .dimension(monthDimension)                
                .group(function (d) {
                    return d['adm3+name'];
                })
                .size(650)
                .columns([
                    function(d){
                       return d['adm4']; 
                    },
                    function(d){
                       return d['date+published']; 
                    },
                    function(d){
                       return d['org+lead']; 
                    },
                    function(d){
                       return d['meta+assessmenttitle']; 
                    },
                    function(d){
                        if(d['sector'].length>4){
                            return 'Multisectoral'
                        }
                       return d['sector']; 
                    },
                    function(d){
                       return '<a href="'+d['meta+url']+'">Link to report</a>'; 
                    }
                ])

    dc.dataCount('#count-info')
            .dimension(cf)
            .group(all);

    dc.renderAll();

    var map = mapChart.map();
    


}

function getSectors(hxlSet){

    var sectorList=[];
    hxlSet.columns.forEach(function(c){
        if(c.tag==='#sector'){
            sectorList.push(c.displayTag);
        }
    });
    return sectorList;
}

function hxlate(data){

    var hxlSet = [];
    data.forEach(function(r){
        var row = [];
        for (var key in r) {
            if(key.substring(0,4)==='gsx$'){
                row.push(r[key]['$t']);
            }
        }
        hxlSet.push(row);        
    })

    return hxl.wrap(hxlSet);
}

function hxlToCF(hxlSet,sectorList,months){

    var columns = ['#org+lead','#adm3+name','#adm3+code','#adm4','#date+published','#meta+assessmenttitle','#meta+url'];
    var cfData = [];

    hxlSet.forEach(function(r){
        var row = {'sector':[]};

        columns.forEach(function(c){
            row[c.substring(1)] = r.get(c);
        });

        sectorList.forEach(function(c){
            if(r.get(c)=='1'){
                var sector = c.substring(8)
                row.sector.push(sector);
            }
        });
        cfData.push(row);
    });

    cfData.forEach(function(d){
        var month = months[parseInt(d['date+published'].substring(3,5))-4];
        var dateFormat = d3.time.format("%d/%m/%Y");
        var week = dateFormat.parse(d['date+published']);
        var earth = new Date(2015,3,25);
        week = Math.ceil((week-earth)/ (1000 * 3600 * 24*7));
        if(week<0){week=0};
        if(month==undefined){
            month='No Date';
        }
        d['date+week'] = week;
    });
    
    return cfData;
}