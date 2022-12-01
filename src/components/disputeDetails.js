import { Card, Row, Col, Form, Accordion, Dropdown, Button } from "react-bootstrap";
import React from "react";
import BigNumber from "bignumber.js";
const DECIMALS = BigNumber(10).pow(BigNumber(18));
import * as realitioLibQuestionFormatter from "@reality.eth/reality-eth-lib/formatters/question";
import { ReactComponent as AvatarSVG } from "../assets/images/avatar.svg";
import { ReactComponent as ScalesSVG } from "../assets/images/scales.svg";
import { ReactComponent as InfoSVG } from "../assets/images/info.svg";

import DisputeTimeline from "components/disputeTimeline";
import EvidenceTimeline from "components/evidenceTimeline";
import CrowdfundingCard from "components/crowdfundingCard";
import web3 from "web3";
const { toBN, toHex, hexToUtf8 } = web3.utils;

import AlertMessage from "components/alertMessage";

import styles from "components/styles/disputeDetails.module.css";


const QuestionTypes = Object.freeze({
  "single-select": "Multiple choice: single select",
  "multiple-select": "Multiple choice: multiple select",
  uint: "Non-negative number",
  int: "Number",
  string: "Text",
  datetime: "Date",
});

class DisputeDetails extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeKey: 0,
    };
  }

  componentDidUpdate(previousProperties) {
    if (this.props.arbitratorDisputeID !== previousProperties.arbitratorDisputeID) {
      this.setState({ activeKey: 0 });
    }
  }

  calculateTotalCost = (rulingOption, arbitrated) => {
    // Unslashed contract violates IDisputeResolver interface by not letting option 0: refuse to rule to be funded.
    // Subsequently, in case of a ruling 0, contract considers remaining ruling options as winners, instead of losers.
    // Therefore we have to make an exception in this function for the following list of irregular contracts.


    const { currentRuling, multipliers, exceptionalContractAddresses } = this.props;

    const appealCost = BigNumber(this.props.appealCost);
    let stake;

    if (currentRuling == rulingOption || (exceptionalContractAddresses.includes(arbitrated) && currentRuling == 0)) {
      console.log(`exception for ruling ${rulingOption}`);
      stake = appealCost.times(BigNumber(multipliers.winnerStakeMultiplier)).div(BigNumber(multipliers.denominator));
    }

    else {
      return this.calculateAmountRemainsToBeRaisedForLoser();
    }

    return appealCost.plus(stake);
  };

  calculateAmountRemainsToBeRaised = (rulingOption, arbitrated) => {
    const { contributions } = this.props;
    const raisedSoFar = contributions[rulingOption] ? BigNumber(contributions[rulingOption]) : 0;
    return this.calculateTotalCost(rulingOption, arbitrated).minus(raisedSoFar);
  };

  calculateAmountRemainsToBeRaisedForLoser = () => {
    const { multipliers } = this.props;

    const appealCost = BigNumber(this.props.appealCost);
    let stake = appealCost.times(BigNumber(multipliers.loserStakeMultiplier)).div(BigNumber(multipliers.denominator));

    return appealCost.plus(stake);
  };

  calculateReturnOfInvestmentRatio = (rulingOption, arbitrated) => {
    // Unslashed contract violates IDisputeResolver interface by not letting option 0: refuse to rule to be funded.
    // Subsequently, in case of a ruling 0, contract considers remaining ruling options as winners, instead of losers.
    // Therefore we have to make an exception in this function for the following list of irregular contracts.

    const { currentRuling, multipliers, exceptionalContractAddresses } = this.props;

    const winner = BigNumber(multipliers.winnerStakeMultiplier);
    const loser = BigNumber(multipliers.loserStakeMultiplier);

    const divisor = BigNumber(multipliers.denominator);

    if (currentRuling == rulingOption || (exceptionalContractAddresses.includes(arbitrated) && currentRuling == 0)) {
      console.log(`ROI ratio for ruling option ${rulingOption}`)
      return winner.plus(loser).plus(divisor).div(winner.plus(divisor));
    } else {
      return winner.plus(loser).plus(divisor).div(loser.plus(divisor));
    }
  };

  calculateReturnOfInvestmentRatioForLoser = () => {
    const {  multipliers } = this.props;
    const winner = BigNumber(multipliers.winnerStakeMultiplier);
    const loser = BigNumber(multipliers.loserStakeMultiplier);
    const divisor = BigNumber(multipliers.denominator);

    return winner.plus(loser).plus(divisor).div(loser.plus(divisor));
  };

  calculateAppealPeriod = (rulingOption) => {
    const { currentRuling, multipliers, appealPeriod } = this.props;
    const loser = multipliers.loserAppealPeriodMultiplier;
    const divisor = multipliers.denominator;

    if (currentRuling == rulingOption) return appealPeriod.end;
    else return parseInt(appealPeriod.start) + ((parseInt(appealPeriod.end) - parseInt(appealPeriod.start)) * parseInt(loser)) / divisor;
  };

  calculateLoserAppealPeriod = () => {
    const { multipliers, appealPeriod } = this.props;
    const loser = multipliers.loserAppealPeriodMultiplier;
    const divisor = multipliers.denominator;

    return parseInt(appealPeriod.start) + ((parseInt(appealPeriod.end) - parseInt(appealPeriod.start)) * parseInt(loser)) / divisor;
  };





  convertToRealitioFormat = (currentRuling, metaEvidenceJSON) => {
    return realitioLibQuestionFormatter.getAnswerString(
      {
        decimals: metaEvidenceJSON.rulingOptions.precision,
        outcomes: metaEvidenceJSON.rulingOptions.titles,
        type: metaEvidenceJSON.rulingOptions.type,
      },
      realitioLibQuestionFormatter.padToBytes32(toBN(currentRuling).sub(toBN("1")).toString(16))
    );
  };

  getWinner = (rulingFunded, currentRuling) => {
    if (rulingFunded && rulingFunded.length == 1) return rulingFunded[0];
    else return currentRuling;
  };

  render() {
    const {
      arbitrated,
      metaevidenceJSON,
      evidences,
      arbitratorDisputeID,
      arbitratorDispute,
      incompatible,
      subcourts,
      subcourtDetails,
      arbitratorDisputeDetails,
      currentRuling,
      disputeEvent,
      publishCallback,
      submitEvidenceCallback,
      appealCost,
      appealPeriod,
      appealCallback,
      contributions,
      rulingFunded,
      multipliers,
      totalWithdrawable,
      exceptionalContractAddresses
    } = this.props;
    const { activeKey } = this.state;

    console.debug(this.props)

    const decisionInfoBoxContent = `This decision can be appealed within appeal period. ${incompatible ? "Go to arbitrable application to appeal this ruling." : ""}`;

    if (metaevidenceJSON && arbitratorDispute && subcourts && subcourtDetails && arbitratorDisputeDetails)
      return (
        <section className={styles.disputeDetails}>
          <DisputeTimeline
            period={arbitratorDispute.period}
            lastPeriodChange={arbitratorDispute.lastPeriodChange}
            subcourtID={arbitratorDispute.subcourtID}
            subcourt={subcourts[arbitratorDispute.subcourtID]}
          />
          <hr className="mt-4" />
          <Row>
            <Col xl={6} md="auto" sm={true} xs={24}>
              <Form.Group>
                <Form.Label htmlFor="category">Dispute</Form.Label>
                <Form.Control id="category" as="span" title="" className="mr-4">
                  <i className="purple-primary">#</i> {arbitratorDisputeID}
                </Form.Control>
              </Form.Group>
            </Col>
            <Col xl={6} md="auto" sm={true} xs={24}>
              <Form.Group className="">
                <Form.Label htmlFor="initialNumberOfJurors">Number of Votes</Form.Label>
                <Form.Control className={`mr-4 ${styles.spanWithSvgInside}`} id="initialNumberOfJurors" as="span">
                  <AvatarSVG />
                  <span>{arbitratorDisputeDetails.votesLengths.slice(-1)}</span>
                </Form.Control>
              </Form.Group>
            </Col>
            <Col md={true} sm={24}>
              <Form.Group>
                <Form.Label htmlFor="court">Court</Form.Label>
                <Form.Control className={styles.spanWithSvgInside} id="court" as="span">
                  <ScalesSVG className={styles.scales} />
                  <span>{subcourtDetails[arbitratorDispute.subcourtID].name}</span>
                </Form.Control>
              </Form.Group>
            </Col>
          </Row>

          {arbitratorDispute.period == 3 && (
            <AlertMessage
              type="info"
              title={`Jury decision: ${currentRuling == 0 ? "invalid / refused to arbitrate / tied" : this.convertToRealitioFormat(currentRuling, metaevidenceJSON)}`}
              content={decisionInfoBoxContent}
            />
          )}
          {arbitratorDispute.period == 4 && (
            <AlertMessage
              type="info"
              title={`Winner: ${
                currentRuling == 0 ? "invalid / refused to arbitrate / tied" : this.convertToRealitioFormat(this.getWinner(rulingFunded, currentRuling), metaevidenceJSON)
              }`}
              content={`${this.getWinner(rulingFunded, currentRuling) != currentRuling ? "Won by default" : "Won by jury decision"}`}
            />
          )}

          <Accordion
            className={`mt-4 ${styles.accordion}`}
            onSelect={(e) => {
              this.setState({ activeKey: e });
            }}
          >
            <Card>
              {arbitratorDispute && arbitratorDispute.period >= 3 && contributions && multipliers && appealCost && appealPeriod && arbitrated &&  (
                <>
                  <Accordion.Toggle className={activeKey == 1 ? "open" : "closed"} as={Card.Header} eventKey="1">
                    Appeal
                  </Accordion.Toggle>
                  <Accordion.Collapse eventKey="1">
                    <Card.Body>
                      <div className="h1">{arbitratorDispute.period == 3 ? "Appeal the decision" : "Withdraw crowdfunding rewards and refunds"}</div>
                      <p className="label">
                        {arbitratorDispute.period == 3
                          && "In order to appeal the decision, you need to fully fund the crowdfunding deposit. The dispute will be sent" +
                          " to the jurors when the full deposit is reached. Note that if the previous round loser funds its side, the previous round winner should also fully fund its side in order not to lose the case."
                          }
                        {arbitratorDispute.period == 4 && parseInt(totalWithdrawable) != 0 ? "If you have contributed to a ruling option and in the end that ruling option was the winner you are eligible for some reward. Also, if you have contributed but appeal did not happen your contribution is refunded."
                          : "You don't have any amount to withdraw. Reason might be that you did not contribute, the ruling option you have contributed did not win, you already withdrew or the ruling is not executed yet by the arbitrator."}
                      </p>
                      {arbitratorDispute.period == 4 && parseInt(totalWithdrawable) > 0 && (
                        <Row className="mt-5">
                          <Col className="text-right">
                            <Button className="ml-auto" onClick={this.props.withdrawCallback}>
                              {`Withdraw ${BigNumber(totalWithdrawable).div(DECIMALS).toString()} ETH`}
                            </Button>
                          </Col>
                        </Row>
                      )}

                      {arbitratorDispute.period == 3 && (
                        <Row className="mt-3">
                          {!exceptionalContractAddresses.includes(arbitrated) && <Col className="pb-4" xl={8} lg={12} xs={24}>
                            <CrowdfundingCard
                              key={0}
                              title={"Invalid / Refused to Arbitrate / Tied"}
                              winner={currentRuling == 0}
                              fundingPercentage={contributions.hasOwnProperty(0) ? BigNumber(contributions[0]).div(this.calculateTotalCost(0, arbitrated)).times(100).toFixed(2) : 0}
                              appealPeriodEnd={this.calculateAppealPeriod(0)}
                              suggestedContribution={this.calculateAmountRemainsToBeRaised(0, arbitrated).div(DECIMALS).toString()}
                              roi={this.calculateReturnOfInvestmentRatio(0, arbitrated).toFixed(2)}
                              appealCallback={appealCallback}
                              rulingOptionCode={0}
                            />
                          </Col>}
                          {metaevidenceJSON.rulingOptions &&
                            metaevidenceJSON.rulingOptions.reserved &&
                            Object.entries(metaevidenceJSON.rulingOptions.reserved).map(([rulingCode, title]) => (
                              <Col key={web3.utils.hexToNumberString(rulingCode)} className="pb-4" xl={8} lg={12} xs={24}>
                                <CrowdfundingCard
                                  key={web3.utils.hexToNumberString(rulingCode)}
                                  title={title}
                                  winner={currentRuling == web3.utils.hexToNumberString(rulingCode)}
                                  fundingPercentage={contributions.hasOwnProperty(web3.utils.hexToNumberString(rulingCode)) ? BigNumber(contributions[web3.utils.hexToNumberString(rulingCode)]).div(this.calculateTotalCost(web3.utils.hexToNumberString(rulingCode)), arbitrated).times(100).toFixed(2) : 0}
                                  appealPeriodEnd={this.calculateAppealPeriod(web3.utils.hexToNumberString(rulingCode))}
                                  suggestedContribution={this.calculateAmountRemainsToBeRaised(web3.utils.hexToNumberString(rulingCode), arbitrated).div(DECIMALS).toString()}
                                  roi={this.calculateReturnOfInvestmentRatio(web3.utils.hexToNumberString(rulingCode), arbitrated).toFixed(2)}
                                  appealCallback={appealCallback}
                                  rulingOptionCode={rulingCode}
                                />
                              </Col>
                            ))}
                          {metaevidenceJSON &&
                            metaevidenceJSON.rulingOptions.type == "single-select" &&
                            metaevidenceJSON.rulingOptions.titles.map((title, index) => (
                              <Col key={index + 1} className="pb-4" xl={8} lg={12} xs={24}>
                                <CrowdfundingCard
                                  title={title}
                                  winner={currentRuling == index + 1}
                                  fundingPercentage={
                                    contributions.hasOwnProperty(index + 1)
                                      ? BigNumber(contributions[index + 1])
                                          .div(this.calculateTotalCost(index + 1, arbitrated))
                                          .times(100)
                                          .toFixed(2)
                                      : 0
                                  }
                                  appealPeriodEnd={this.calculateAppealPeriod(index + 1)}
                                  suggestedContribution={this.calculateAmountRemainsToBeRaised(index + 1, arbitrated)
                                    .div(DECIMALS)
                                    .toString()}
                                  roi={this.calculateReturnOfInvestmentRatio(index + 1, arbitrated).toFixed(2)}
                                  appealCallback={appealCallback}
                                  rulingOptionCode={index + 1}
                                />
                              </Col>
                            ))}
                          {metaevidenceJSON &&
                            metaevidenceJSON.rulingOptions.type == "multiple-select" &&
                            Array.from(Array(2 ** metaevidenceJSON.rulingOptions.titles.length).keys()).map((_key, index) => (
                              <Col key={index} className="pb-4" xl={8} lg={12} xs={24}>
                                <CrowdfundingCard
                                  title={
                                    index == 0
                                      ? "None"
                                      : index
                                          .toString(2)
                                          .padStart(4, "0")
                                          .split("")
                                          .reverse()
                                          .map((bit, i) => (bit == 1 ? metaevidenceJSON.rulingOptions.titles[i] : null))
                                          .join(" ")
                                  }
                                  winner={currentRuling == index + 1}
                                  fundingPercentage={
                                    contributions.hasOwnProperty(index + 1)
                                      ? BigNumber(contributions[index + 1])
                                          .div(this.calculateTotalCost(index + 1, arbitrated))
                                          .times(100)
                                          .toFixed(2)
                                      : 0
                                  }
                                  appealPeriodEnd={this.calculateAppealPeriod(index + 1)}
                                  roi={this.calculateReturnOfInvestmentRatio(index + 1, arbitrated).toFixed(2)}
                                  suggestedContribution={this.calculateAmountRemainsToBeRaised(index + 1, arbitrated)
                                    .div(DECIMALS)
                                    .toString()}
                                  appealCallback={appealCallback}
                                  rulingOptionCode={index + 1}
                                />
                              </Col>
                            ))}

                          {metaevidenceJSON &&
                            ["uint", "int", "string", "datetime"].includes(metaevidenceJSON.rulingOptions.type) &&
                            Object.keys(contributions)
                              .filter((key) => key != this.props.currentRuling)
                              .map((key, _) => (
                                <Col key={key} className="pb-4" xl={8} lg={12} xs={24}>
                                  <CrowdfundingCard
                                    title={metaevidenceJSON.rulingOptions.type == "string" ? hexToUtf8(toHex(key)) : this.convertToRealitioFormat(key, metaevidenceJSON)}
                                    rulingOptionCode={key}
                                    winner={currentRuling == key}
                                    fundingPercentage={
                                      contributions.hasOwnProperty(key) ? BigNumber(contributions[key]).div(this.calculateTotalCost(key, arbitrated)).times(100).toFixed(2) : 0
                                    }
                                    suggestedContribution={this.calculateAmountRemainsToBeRaised(key, arbitrated).div(DECIMALS).toString()}
                                    appealPeriodEnd={this.calculateAppealPeriod(key)}
                                    roi={this.calculateReturnOfInvestmentRatio(key, arbitrated).toFixed(2)}
                                    appealCallback={appealCallback}
                                    metaevidenceJSON={metaevidenceJSON}
                                  />
                                </Col>
                              ))}
                          {metaevidenceJSON && ["uint", "int", "string", "datetime"].includes(metaevidenceJSON.rulingOptions.type) && this.props.currentRuling != 0 && (
                            <Col className="pb-4" xl={8} lg={12} xs={24}>
                              <CrowdfundingCard
                                title={`${this.convertToRealitioFormat(currentRuling, metaevidenceJSON)}`}
                                rulingOptionCode={this.props.currentRuling}
                                winner={true}
                                fundingPercentage={
                                  contributions.hasOwnProperty(this.props.currentRuling)
                                    ? BigNumber(contributions[this.props.currentRuling]).div(this.calculateTotalCost(this.props.currentRuling, arbitrated)).times(100).toFixed(2)
                                    : 0
                                }
                                appealPeriodEnd={this.calculateAppealPeriod(this.props.currentRuling)}
                                roi={this.calculateReturnOfInvestmentRatio(this.props.currentRuling, arbitrated).toFixed(2)}
                                suggestedContribution={this.calculateAmountRemainsToBeRaised(this.props.currentRuling, arbitrated).div(DECIMALS).toString()}
                                appealCallback={appealCallback}
                                metaevidenceJSON={metaevidenceJSON}
                              />
                            </Col>
                          )}
                          {metaevidenceJSON && ["uint", "int", "string", "datetime"].includes(metaevidenceJSON.rulingOptions.type) && (
                            <Col className="pb-4" xl={8} lg={12} xs={24}>
                              <CrowdfundingCard
                                variable={metaevidenceJSON.rulingOptions.type}
                                winner={false}
                                fundingPercentage={0}
                                appealPeriodEnd={this.calculateLoserAppealPeriod()}
                                roi={this.calculateReturnOfInvestmentRatioForLoser().toFixed(2)}
                                suggestedContribution={this.calculateAmountRemainsToBeRaisedForLoser().div(DECIMALS).toString()}
                                appealCallback={appealCallback}
                                metaevidenceJSON={metaevidenceJSON}
                              />
                            </Col>
                          )}
                        </Row>
                      )}
                    </Card.Body>
                  </Accordion.Collapse>
                </>
              )}
            </Card>

            <Card>
              <Accordion.Toggle className={activeKey == 2 ? "open" : "closed"} as={Card.Header} eventKey="2">
                Question
              </Accordion.Toggle>
              <Accordion.Collapse eventKey="2">
                <Card.Body className={styles.question}>
                  <p>{QuestionTypes[metaevidenceJSON.rulingOptions?.type]}</p>
                  <p>{metaevidenceJSON.question}</p>
                  {(metaevidenceJSON.rulingOptions?.type == "single-select" || metaevidenceJSON.rulingOptions?.type == "multiple-select") && (
                    <>
                      <Dropdown>
                        <Dropdown.Toggle  block className={styles.dropdownToggle}>
                          <span className="font-weight-normal">View Voting Options</span>
                        </Dropdown.Toggle>

                        <Dropdown.Menu>
                          <Dropdown.Item key={0} disabled>Option 0 Refuse to Arbitrate</Dropdown.Item>
                          {metaevidenceJSON.rulingOptions.titles.map((title, index) => (
                            <Dropdown.Item key={index} disabled>{`Option ${index + 1} ${title}${
                              metaevidenceJSON.rulingOptions.descriptions && metaevidenceJSON.rulingOptions.descriptions[index] != undefined ? ":" : ""
                            } ${
                              metaevidenceJSON.rulingOptions.descriptions && metaevidenceJSON.rulingOptions.descriptions[index] != undefined
                                ? metaevidenceJSON.rulingOptions.descriptions[index]
                                : ""
                            }`}</Dropdown.Item>
                          ))}
                          {metaevidenceJSON.rulingOptions?.reserved &&
                            Object.entries(metaevidenceJSON.rulingOptions.reserved).map(([rulingCode, title]) => (
                              <Dropdown.Item key={rulingCode} disabled>{`Option ${rulingCode.length > 12 ? (rulingCode.slice(0,6)+"..."+rulingCode.slice(-6)) : rulingCode} ${title}${
                                metaevidenceJSON.rulingOptions.descriptions && metaevidenceJSON.rulingOptions.descriptions[rulingCode] != undefined ? ":" : ""
                              } ${
                                metaevidenceJSON.rulingOptions.descriptions && metaevidenceJSON.rulingOptions.descriptions[rulingCode] != undefined
                                  ? metaevidenceJSON.rulingOptions.descriptions[rulingCode]
                                  : ""
                              }`}</Dropdown.Item>
                            ))}

                        </Dropdown.Menu>
                      </Dropdown>
                      <p className={styles.questionInfo}>
                        <InfoSVG />
                        Note that you can only view the voting options. Selected jurors can vote using{" "}
                        <a href={`https://court.kleros.io/cases/${arbitratorDisputeID}`} target="_blank" rel="noreferrer noopener">
                          Court
                        </a>
                        .
                      </p>
                    </>
                  )}
                </Card.Body>
              </Accordion.Collapse>
            </Card>

            <Card>
              <Accordion.Toggle className={activeKey == 3 ? "open" : "closed"} as={Card.Header} eventKey="3">
                Evidence
              </Accordion.Toggle>
              <Accordion.Collapse eventKey="3">
                <Card.Body>
                  <EvidenceTimeline
                    evidenceSubmissionEnabled={!incompatible}
                    metaevidence={metaevidenceJSON}
                    evidences={evidences}
                    dispute={disputeEvent}
                    disputePeriod={parseInt(arbitratorDispute.period)}
                    publishCallback={publishCallback}
                    submitEvidenceCallback={submitEvidenceCallback}
                    appealDecisions={this.state.appealDecisions}
                  />
                </Card.Body>
              </Accordion.Collapse>
            </Card>
          </Accordion>
        </section>
      );
    else return <div></div>;
  }
}

export default DisputeDetails;
