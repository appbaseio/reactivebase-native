import React, { Component } from "react";
import { View, Dimensions } from "react-native";
import { Input, Item, List, ListItem, Text, Button } from "native-base";
import { connect } from "react-redux";

import { addComponent, removeComponent, watchComponent, updateQuery } from "../actions";
import { isEqual, debounce, pushToAndClause } from "../utils/helper";

class DataSearch extends Component {
	constructor(props) {
		super(props);

		this.state = {
			currentValue: "",
			suggestions: [],
			showOverlay: false
		};
		this.internalComponent = this.props.componentId + "__internal";
	}

	componentDidMount() {
		this.props.addComponent(this.props.componentId);
		this.props.addComponent(this.internalComponent);
		this.setReact(this.props);
		this.updateQuery = debounce((component, value) => {
			this.props.updateQuery(component, this.defaultQuery(value));
		}, 300);
	}

	componentWillReceiveProps(nextProps) {
		if (!isEqual(nextProps.react, this.props.react)) {
			this.setReact(nextProps);
		}
		if (Array.isArray(nextProps.suggestions)
			&& !isEqual(this.props.suggestions, nextProps.suggestions)
			&& this.state.currentValue.trim() !== "") {
			this.setState({
				suggestions: nextProps.suggestions
			});
		}
	}

	componentWillUnmount() {
		this.props.removeComponent(this.props.componentId);
		this.props.removeComponent(this.internalComponent);
	}

	setReact(props) {
		const { react } = props;
		if (props.react) {
			newReact = pushToAndClause(react, this.internalComponent)
			props.watchComponent(props.componentId, newReact);
		} else {
			props.watchComponent(props.componentId, { and: this.internalComponent });
		}
	}

	defaultQuery(value) {
		let finalQuery = null,
			fields;
		if (value) {
			if (Array.isArray(this.props.appbaseField)) {
				fields = this.props.appbaseField;
			} else {
				fields = [this.props.appbaseField];
			}
			finalQuery = {
				bool: {
					should: this.shouldQuery(value, fields),
					minimum_should_match: "1"
				}
			};
		}

		if (value === "") {
			finalQuery = {
				"match_all": {}
			}
		}

		return finalQuery;
	}

	shouldQuery(value, appbaseFields) {
		const fields = appbaseFields.map(
			(field, index) => `${field}${(Array.isArray(this.props.weights) && this.props.weights[index]) ? ("^" + this.props.weights[index]) : ""}`
		);

		if (this.props.queryFormat === "and") {
			return [
				{
					multi_match: {
						query: value,
						fields,
						type: "cross_fields",
						operator: "and",
						fuzziness: this.props.fuzziness ? this.props.fuzziness : 0
					}
				},
				{
					multi_match: {
						query: value,
						fields,
						type: "phrase_prefix",
						operator: "and"
					}
				}
			];
		}

		return [
			{
				multi_match: {
					query: value,
					fields,
					type: "best_fields",
					operator: "or",
					fuzziness: this.props.fuzziness ? this.props.fuzziness : 0
				}
			},
			{
				multi_match: {
					query: value,
					fields,
					type: "phrase_prefix",
					operator: "or"
				}
			}
		];
	}

	setValue = (value) => {
		this.setState({
			currentValue: value,
			suggestions: []
		});
		if (this.props.autoSuggest) {
			this.updateQuery(this.internalComponent, value);
		} else {
			this.updateQuery(this.props.componentId, value);
		}
	};

	selectSuggestion = (value) => {
		this.setState({
			currentValue: value,
			suggestions: []
		});
		this.updateQuery(this.props.componentId, value);
		this.toggleOverlay();
	};

	setSuggestions = () => {
		let suggestions = [];
		if (this.state.currentValue.trim() !== "") {
			suggestions = this.props.suggestions;
		}

		this.setState({
			suggestions
		});
	};

	toggleOverlay = () => {
		this.setState({
			showOverlay: !this.state.showOverlay
		})
	}

	renderSuggestions() {
		if (this.props.autoSuggest && Array.isArray(this.state.suggestions)) {
			return (<List dataArray={this.state.suggestions}
				renderRow={(item) =>
					<ListItem
						onPress={() => this.selectSuggestion(item._source.name)}
					>
						<Text>{item._source.name}</Text>
					</ListItem>
				}>
			</List>)
		}

		return null;
	}

	renderDataSearch = () => {
		if (this.state.showOverlay) {
			return (<View>
				<View style={{ flexDirection: "row", justifyContent: "space-between" }}>
					<Button style={{paddingLeft: 0, paddingRight: 0}} transparent dark onPress={this.toggleOverlay}><Text>Back</Text></Button>
					{
						this.state.currentValue
							? <Button style={{paddingLeft: 0, paddingRight: 0}} transparent onPress={() => this.selectSuggestion("")}><Text>Reset</Text></Button>
							: null
					}
				</View>
				<Item regular style={{marginLeft: 0}}>
					<Input
						placeholder={this.props.placeholder}
						onChangeText={this.setValue}
						value={this.state.currentValue}
						onFocus={this.setSuggestions}
						autoFocus
					/>
				</Item>
				{this.renderSuggestions()}
			</View>);
		}

		return (<Item regular style={{marginLeft: 0}}>
			<Input
				onFocus={this.toggleOverlay}
				placeholder={this.props.placeholder}
				value={this.state.currentValue}
			/>
		</Item>);
	}

	render() {
		let styles = {};
		if (this.state.showOverlay) {
			styles = {
				width: Dimensions.get("window").width,
				height: Dimensions.get("window").height,
				position: "absolute",
				paddingLeft: 10,
				paddingRight: 10,
				top: 0,
				right: 0,
				bottom: 0,
				left: 0,
				backgroundColor: "white",
				zIndex: 10
			}
		}

		return (
			<View style={{ width: "100%", ...styles }}>
				{
					this.props.autoSuggest
						? this.renderDataSearch()
						: <Item regular style={{marginLeft: 0}}>
							<Input
								placeholder={this.props.placeholder}
								onChangeText={this.setValue}
								value={this.state.currentValue}
							/>
						</Item>
				}
			</View>
		);
	}
}

DataSearch.defaultProps = {
	placeholder: "Search",
	autoSuggest: true,
	queryFormat: "or"
}

const mapStateToProps = (state, props) => ({
	suggestions: state.hits[props.componentId]
});

const mapDispatchtoProps = dispatch => ({
	addComponent: component => dispatch(addComponent(component)),
	removeComponent: component => dispatch(removeComponent(component)),
	watchComponent: (component, react) => dispatch(watchComponent(component, react)),
	updateQuery: (component, query) => dispatch(updateQuery(component, query))
});

export default connect(mapStateToProps, mapDispatchtoProps)(DataSearch);