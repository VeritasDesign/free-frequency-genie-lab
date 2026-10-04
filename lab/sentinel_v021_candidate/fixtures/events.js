export const fixtures = {
  watch: {
    place: "Home · 25 mi watch",
    coverage: "fixture",
    lastUpdate: "Sample coverage snapshot · not live",
    state: "current",
    headline: "Nothing needs your attention in these sample sources.",
    blindSpot: "Your watch has a blind spot",
    layers: [
      {name:"Weather & alerts", source:"NOAA/NWS adapter", status:"sample-current"},
      {name:"Earthquakes", source:"USGS adapter", status:"sample-current"},
      {name:"Fire/hotspots", source:"NASA FIRMS adapter", status:"sample-current"},
      {name:"Air quality", source:"AirNow adapter", status:"sample-current"}
    ]
  },
  events: [
    {
      id:"skw5635", kind:"aircraft", title:"SKW5635", kicker:"USER-REPORTED · AIR & SEA",
      x:52, y:47, marker:"✈", tone:"investigate",
      summary:"Reported ORD→MBS flight later returned to Chicago. The reason is not established.",
      provenance:"Origin: user report · Original flight date/records unavailable",
      time:"Event time: UNKNOWN · Fixture position is synthetic",
      answer:"The reported route returned to Chicago. We don't yet have evidence establishing why.",
      timeline:[
        ["USER-REPORTED","ORD → MBS","A historical account reports the flight operating toward MBS."],
        ["USER-REPORTED","Descent near MBS","The account reports descent near MBS without completing the landing."],
        ["USER-REPORTED","Movement toward Flint/Bishop and Lansing areas","These are reported areas, not verified diversions or approaches."],
        ["USER-REPORTED","Return to Chicago","The supplied account says the route ultimately returned to Chicago."],
        ["UNKNOWN","Why?","No flight date, operational record, weather alignment or direct causal evidence is available in V0 fixtures."]
      ],
      evidence:[
        ["OBSERVED","No independently observed flight record is connected in this fixture.","No live aviation feed is connected."],
        ["VERIFIED","No real-world claim has been independently verified here.","V0 intentionally refuses to upgrade the user report."],
        ["INFERRED","No causal inference is made.","Weather or airport context would not by itself establish cause."],
        ["UNKNOWN","Cause, exact times, altitudes and operational status remain unknown.","Required primary evidence is absent."]
      ]
    },
    {
      id:"aurora", kind:"aurora", title:"Aurora window", kicker:"DON'T MISS · SYNTHETIC FORECAST",
      x:79, y:25, marker:"✦", tone:"wonder",
      summary:"Sample viewing window tonight. This is a product fixture, not a real aurora forecast.",
      provenance:"Fixture adapter · modeled example only",
      time:"Sample window: 10:20 PM–12:10 AM · not current",
      answer:"This fixture demonstrates how Sentinel separates a space-weather opportunity from actual local visibility.",
      timeline:[
        ["OBSERVED","Synthetic forecast object loaded","This event comes from the local fixture adapter, not NOAA."],
        ["INFERRED","Potential viewing opportunity","A real implementation would combine forecast probability with darkness/cloud context."],
        ["UNKNOWN","Actual visibility","No live cloud, aurora or local-sky observation is connected."]
      ],
      evidence:[
        ["OBSERVED","Fixture data exists locally.","This supports only the interaction demonstration."],
        ["VERIFIED","No real aurora condition is verified.","The UI must not imply otherwise."],
        ["INFERRED","A real opportunity could merit a one-time reminder.","Reminder interest is separate from warning subscriptions."],
        ["UNKNOWN","Whether anything is visible outside.","No live source or device location is used."]
      ]
    },
    {id:"quake",kind:"earth",title:"M 2.1 sample quake",kicker:"WEATHER & EARTH · FIXTURE",x:24,y:70,marker:"◆",tone:"neutral",summary:"Synthetic low-magnitude event for layer density.",provenance:"USGS-shaped fixture · not live",time:"Sample only",answer:"A fixture demonstrating an event that may be interesting without being personally relevant.",timeline:[["OBSERVED","Fixture record","Local sample only."]],evidence:[["OBSERVED","Fixture event loaded.","Not a USGS observation."]]}
  ]
};
