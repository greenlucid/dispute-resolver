import React from "react";
import { Accordion, Container, Col, Row, Button, Form, Card, Dropdown, Badge } from "react-bootstrap";
import { ReactComponent as ScalesSVG } from "../assets/images/scales.svg";
import { Redirect, Link } from "react-router-dom";
import Countdown from "react-countdown-now";
import BigNumber from "bignumber.js";

const span = Object.freeze({ xs: 12, sm: 12, md: 6, lg: 6, xl: 4 });

class openDisputeIDs extends React.Component {
  constructor(props) {
    super(props);
    this.state = { openDisputeIDs: [], arbitratorDisputes: {} };
  }
  componentDidMount() {
    this.props.getOpenDisputesCallback().then((response) => {
      this.setState({ openDisputeIDs: response.openDisputes });
      response.openDisputes.map((dispute) => this.props.getMetaEvidenceCallback(dispute).then((response) => this.setState({ [dispute]: response })));

      response.openDisputes.map((arbitratorDispute) => {
        this.props.getArbitratorDisputeCallback(arbitratorDispute).then((response) => {
          this.setState({ ["arbitrator" + arbitratorDispute]: response });
        });
        this.props.getCurrentRulingCallback(arbitratorDispute).then((response) => this.setState({ ["arbitratorRuling" + arbitratorDispute]: response }));
      });
    });
  }

  getPeriodName = (periodNumber) => {
    const strings = ["Evidence Period", "Commit Period", "Vote Period", "Appeal Period", "Execution Period"];

    return strings[periodNumber];
  };

  render() {
    console.debug(this.state);
    console.debug(this.props);

    const { openDisputeIDs, selectedDispute } = this.state;
    const { subcourts, subcourtDetails } = this.props;

    if (selectedDispute) return <Redirect to={`/interact/${selectedDispute}`} />;

    return (
      <Container fluid className="main-content">
        <Form.Row style={{ margin: 0 }}>
          {openDisputeIDs.map((dispute) => (
            <Col style={{ display: "flex", flexDirection: "column" }} key={dispute} xl={span.xl} lg={span.lg} md={span.md} sm={span.sm} xs={span.xs}>
              {this.state[dispute] && (
                <Card style={{ cursor: "pointer", height: "100%" }} onClick={(e) => this.setState({ selectedDispute: dispute })}>
                  <Card.Header>
                    <Form.Row className="w-100">
                      <Col xs={12} style={{ textAlign: "center" }}>
                        <ScalesSVG style={{ float: "left", height: "100%", width: "auto" }} />
                        {this.state[`arbitrator${dispute}`] && subcourtDetails && <span>{subcourtDetails[this.state[`arbitrator${dispute}`].subcourtID].name}</span>}
                        <span style={{ float: "right" }}>{dispute}</span>
                      </Col>
                    </Form.Row>
                  </Card.Header>
                  <Card.Body style={{ borderRadius: 0, display: "flex", flexDirection: "column" }}>
                    <Form.Row>
                      <Col>{this.state[dispute].metaEvidenceJSON.title}</Col>
                    </Form.Row>
                    {this.state[`arbitrator${dispute}`].period == 3 && (
                      <Form.Row style={{ marginTop: "auto", paddingTop: "2.5rem" }}>
                        <Col>
                          <Badge style={{ fontSize: "1rem", padding: "0.6rem 0.6rem" }} className="purple text-wrap w-100">
                            Jurors ruled: {this.state[dispute].metaEvidenceJSON.rulingOptions.titles[this.state[`arbitratorRuling${dispute}`] - 1]}
                          </Badge>
                        </Col>
                      </Form.Row>
                    )}
                  </Card.Body>
                  <Card.Footer style={{ backgroundColor: "#F5F1FD", borderBottomLeftRadius: "12px", borderBottomRightRadius: "12px", borderTop: 0, textAlign: "end" }}>
                    {this.state[`arbitrator${dispute}`] && subcourts && (
                      <>
                        {this.getPeriodName(this.state[`arbitrator${dispute}`].period)}{" "}
                        <Countdown
                          date={BigNumber("1000")
                            .times(BigNumber(this.state[`arbitrator${dispute}`].lastPeriodChange).plus(BigNumber(subcourts[this.state[`arbitrator${dispute}`].subcourtID].timesPerPeriod[this.state[`arbitrator${dispute}`].period])))
                            .toNumber()}
                        />
                      </>
                    )}
                  </Card.Footer>
                </Card>
              )}
            </Col>
          ))}
        </Form.Row>
      </Container>
    );
  }
}

export default openDisputeIDs;
