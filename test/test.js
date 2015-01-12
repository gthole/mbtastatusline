var assert = require("assert");
var MBTAStatusLine = require("../lib");

describe("MBTAStatusLine", function() {
  describe("formatOutput", function() {
    var now, data, content;

    beforeEach(function() {
      now = Math.floor(new Date().getTime() / 1000);
      data = {
        "stop_name": "Foo Station",
        "mode": [
          {"route": [
            {"direction": [
              {"trip": [
                {"pre_dt": "" + (now + 100)}
              ]}
            ]}
          ]}
        ],
        "alert_headers": []
      };
      content = JSON.stringify(data);
    });

    it("Should format output", function() {
      assert.equal(MBTAStatusLine.formatOutput(data), "Foo Station: 1 minute");
    });

    it("Should count alerts if present", function() {
      data.alert_headers = ["foo", "bar", "bazzhands"];
      assert.equal(
        MBTAStatusLine.formatOutput(data),
        "Foo Station: 1 minute; 3 alerts!"
      );
    });

    it("Should ignore past arrivals", function() {
      data.mode[0].route[0].direction[0].trip.push({"pre_dt": now - 100});
      assert.equal(
        MBTAStatusLine.formatOutput(data),
        "Foo Station: 1 minute"
      );
    });

    it("Should format times correctly", function() {
      data.mode[0].route[0].direction[0].trip = [
        {"pre_dt": now + 2},
        {"pre_dt": now + 200},
        {"pre_dt": now + 3800}
      ];
      assert.equal(
        MBTAStatusLine.formatOutput(data),
        "Foo Station: arriving now, 3 minutes, over an hour"
      );
    });
  });
});
