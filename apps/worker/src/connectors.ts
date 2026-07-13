import {
  DataSfTemporaryClosuresConnector,
  Sf511TrafficEventsConnector,
  Sf511WzdxConnector
} from "@road-reality/connectors";

export function createDeclaredStateConnectors() {
  return [
    new Sf511TrafficEventsConnector(),
    new Sf511WzdxConnector(),
    new DataSfTemporaryClosuresConnector()
  ];
}

