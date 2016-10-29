/**
 * @overview RM Visual Plugin module
 * @version 1.00
 * @author Minesh Patel
*/

/**
	* Contains functions for visualisation generation and management.
    * General prototype extensions for JavaScript and associated libraries are also found here.
	* Includes configuration functions, as well as classes and functions for drawing SVG/HTML elements.
	* @exports rmvpp
*/
var rmvpp = (function(rmvpp) {

	/**
        * Retrieves list of all available plugins as an array of plugin IDs.
        * @returns {object[]}
    */
    rmvpp.getPlugins = function() {
        var plugins = [];
        for (var key in rmvpp.Plugins) {
            plugins.push(rmvpp.Plugins[key]);
        }
        plugins.sort(function(a,b) {
            return d3.ascending(a.displayName, b.displayName);
        });
        return plugins;
    }

	/**
        * Returns a configuration object with default values for a given plugin.
        * @param {string} plugin ID of the plugin in which to retrieve configuration for.
    */
	rmvpp.getDefaultConfig = function(plugin) {
		var configObj = {}, configParams = rmvpp.Plugins[plugin].configurationParameters;
		for (var i=0; i < configParams.length; i++) {
            if (configParams[i].inputOptions)
                configObj[configParams[i].targetProperty] = configParams[i].inputOptions.defaultValue;
		}
		return configObj;
	}

	/**
        * Returns default configuration for a given column on a plugin.
        * @param {object} configParams Column configuration parameters defined on a plugin.
        * E.g. `rmvpp.Plugins['table'].columnMappingParameters.columns.config`.#
        * @returns {object} Default configuration for a given plugin column.
    */
	rmvpp.getDefaultColumnConfig = function(configParams) {
		var configObj = {};
		for (var i=0; i < configParams.length; i++) {
			configObj[configParams[i].targetProperty] = configParams[i].inputOptions.defaultValue;
		}
		return configObj;
	}

	/**
        * Returns a default column map for a given plugin.
        * @param {string} plugin Plugin ID to retrieve the column map for.
        * @returns {object} Column map object describing the input format for the plugin.
    */
	rmvpp.getDefaultColumnMap = function(plugin) {
		var columnMap = {}, colMap = rmvpp.Plugins[plugin].columnMappingParameters;
		for (var i=0; i < colMap.length; i++) {
			if (colMap[i].multiple)
				columnMap[colMap[i].targetProperty] = [];
			else
				columnMap[colMap[i].targetProperty] = new obiee.BIColumn ('','');
		}
		return columnMap;
	}

	/**
        * Copies a populated column map to another, following some basic rules around column types.
        * Plugin column parameters of type `dim`, `measure` and `hidden` are mapped respectively in the same order.
        * @param {object} sourceMap Column map of the original visualisation.
        * @param {string} targetPlugin ID of the plugin in which to map the columns onto.
        * @returns {object} Column map of the target plugin with  the original columns mapped.
    */
	rmvpp.importColumnMap = function(sourceMap, targetPlugin) {
		var targetMap = rmvpp.getDefaultColumnMap(targetPlugin);
		var targetParams = rmvpp.Plugins[targetPlugin].columnMappingParameters;

		function matchColumnToMap(allowedTypes, targetMap, col) {
			var filtered = targetParams.filter(function(p) { return $.inArray(p.type, allowedTypes) > -1; });
			var populated = false;
			filtered.forEach(function(fp) {
				if (!populated) { // Break when populated
					if (fp.multiple) {
						targetMap[fp.targetProperty].push(col);
						populated = true;
					} else if (!targetMap[fp.targetProperty].Code) {
						targetMap[fp.targetProperty] = col;
						populated = true;
					}
				}
			});
			return targetMap;
		}

		obiee.applyToColumnMap(sourceMap, function(col, id) {
			if (col.Code) {
				if (id.indexOf('hidden') == 0) { // Map hidden columns between plugins
					targetMap = matchColumnToMap(['hidden'], targetMap, col);
				} else if (col.Measure == 'none') {
					targetMap = matchColumnToMap(['dim', 'any'], targetMap, col);
				} else {
					targetMap = matchColumnToMap(['fact', 'any'], targetMap, col);
				}
			}
		});
		return targetMap;
	}

	/**
        * Takes a configuration object and applies defaults to any missing properties and removes superfluous ones.
        * @param {BIVisual} vis Visualisation which should have configuration cleaned up.
        * @returns {BIVisual} Visualisation with configuration defaults applied and unnecessary parameters removed.
    */
	rmvpp.tidyConfig = function(vis) {
		var defaults = rmvpp.getDefaultConfig(vis.Plugin);
		for (prop in vis.Config) {
			if (!defaults.hasOwnProperty(prop)) {
				delete vis.Config[prop];
			}
		}

		for (prop in defaults) {
			if (!vis.Config.hasOwnProperty(prop)) {
				vis.Config[prop] = defaults[prop]
			}
		}
		return vis;
	}

	/**
		@member
		* Object with properties as plugin IDs indicating the plugins available in the system.
	*/
	rmvpp.Plugins = {};

	/* ------ PLOTTING FUNCTIONS ------ */

	/**
        * @class
        * Charting class which is responsible for creating SVGs, plotting axes and managing orientation.
        * @param {DOM} container DOM element in which to create the chart.
        * @param {number} [width=300] Width of the chart.
        * @param {number} [height=300] Height of the chart.
        * @param {function} [xScale] [D3 scale](https://github.com/mbostock/d3/wiki/Quantitative-Scales) for the X axis.
        * @param {string} [xTitle] Title for the X axis.
        * @param {BIColumn} [xCol] Column for the X axis.
        * @param {string} [yTitle] Title for the Y axis.
        * @param {function} [yScale] [D3 scale](https://github.com/mbostock/d3/wiki/Quantitative-Scales) for the Y axis.
        * @param {BIColumn} [yCol] Column for the Y axis.
        * @param {string} [y2Title] Title for a second Y axis.
        * @param {function} [y2Scale] [D3 scale](https://github.com/mbostock/d3/wiki/Quantitative-Scales) for a second Y axis.
        * @param {BIColumn} [y2Col] Column for a second Y axis.
        * @param {string} [x2Title] Title for a second X axis.
        * @param {function} [x2Scale] [D3 scale](https://github.com/mbostock/d3/wiki/Quantitative-Scales) for a second X axis.
        * @param {BIColumn} [x2Col] Column for a second X axis.
        * @param {boolean} [horizontal=false] Indicates the chart should be orientated horizontally rather than vertically.
    */
	rmvpp.Chart = function(container, width, height, xScale, xTitle, xCol, yTitle, yScale, yCol, y2Title, y2Scale, y2Col, x2Title, x2Scale, x2Col, horizontal) {
        /** Container DOM element. */
        this.Container = container;

        /** Width of the container in pixels. */
		this.Width = width || 300;

        /** Height of the container in pixels. */
		this.Height = height || 300;

        /** Indicates if the chart is horizontally orientated . */
		this.Horizontal = horizontal || false;

		/** Return axis sub objects */
		function axis(title, scale, column) {
			if (scale) {
				return {
					Title : title,
					Scale : scale,
					Column : column
				};
			} else
				return false;
		}

		/**
            * Determines whether the array would need to be rotated to display on an axis, or can't display at all.
            * If the there is enough room, it will display the axis labels on-axis. If they are too long they will rotate.
            * If there are too many labels so they overlap, they should be hidden completely.
        */
		this.axisLabelDisplay = function(axis) {
			var labelArray = this[axis].Scale.domain(), width;

			if (axis.indexOf('X') > -1)
				width = this.Width;
			else
				width = this.Height;

			var axisDisplay = 'Y';
			var maxString = rmvpp.longestString(labelArray); // Assumes 6px per letter
			var elementWidth = width / (labelArray.length); // Define element width dynamically
			var isNumber = labelArray.map(function(d) { return isNaN(d); }).filter(function(d) { return d; }).length == 0;

			if (maxString > elementWidth || isNumber)
				axisDisplay = 'R';

			if (elementWidth < 13)
				axisDisplay = 'N';

			return axisDisplay;
		}

		/**
            * Object for axes to be stored so they can be redrawn later.
            * @property X
            * @property X2
            * @property Y
            * @property Y2
        */
		this.Axes = {
			X : {},
			X2 : {},
			Y : {},
			Y2: {}
		}

        /**
            * Sets the X axis to `this.Axes.X` from input information.
            * @param {string} title Title for the axis
            * @param {function} scale [D3 scale](https://github.com/mbostock/d3/wiki/Quantitative-Scales) function for the axis.
            * @param {BIColumn} col OBIEE column of the axis.
        */
		this.setX = function(title, scale, col) { this.X = axis(title, scale, col); }

        /**
            * Sets the second X axis to `this.Axes.X2` from input information.
            * @param {string} title Title for the axis
            * @param {function} scale [D3 scale](https://github.com/mbostock/d3/wiki/Quantitative-Scales) function for the axis.
            * @param {BIColumn} col OBIEE column of the axis.
        */
		this.setX2 = function(title, scale, col) { this.X2 = axis(title, scale, col); }

        /**
            * Sets the Y axis to `this.Axes.Y` from input information.
            * @param {string} title Title for the axis
            * @param {function} scale [D3 scale](https://github.com/mbostock/d3/wiki/Quantitative-Scales) function for the axis.
            * @param {BIColumn} col OBIEE column of the axis.
        */
		this.setY = function(title, scale, col) { this.Y = axis(title, scale, col); }

        /**
            * Sets the second Y axis to `this.Axes.Y2` from input information.
            * @param {string} title Title for the axis
            * @param {function} scale [D3 scale](https://github.com/mbostock/d3/wiki/Quantitative-Scales) function for the axis.
            * @param {BIColumn} col OBIEE column of the axis.
        */
		this.setY2 = function(title, scale, col) { this.Y2 = axis(title, scale, col); }

		this.setX(xTitle, xScale, xCol);
		this.setX2(x2Title, x2Scale, x2Col);
		this.setY(yTitle, yScale, yCol);
		this.setY2(y2Title, y2Scale, y2Col);

		/**
            * Sets default margin sizes (top, left, right, bottom) to `this.Margin` based on labels, size and axes.
        */
		this.setMargin = function() {
			var maxStringX = rmvpp.longestString(this.X.Scale.domain(), this.X.Column, 7);
			var maxStringX2 = this.Y2.Scale && this.X2.Column ? rmvpp.longestString(this.X2.Scale.domain(), this.X2.Column) : 0;
			var maxStringY = rmvpp.longestString(this.Y.Scale.domain(), this.Y.Column);
			var maxStringY2 = this.Y2.Scale && this.Y2.Column ? rmvpp.longestString(this.Y2.Scale.domain(), this.Y2.Column) : 0;

			var xAxisDisplay = this.axisLabelDisplay('X');
			var x2AxisDisplay = this.X2.Scale ? this.axisLabelDisplay('X2') : 'N';
			var yAxisDisplay = this.axisLabelDisplay('Y');
			var y2AxisDisplay = this.Y2.Scale ? this.axisLabelDisplay('Y2') : 'N';

			var marginBottom = xAxisDisplay == 'R' ? maxStringX + 15 : 10;
			var marginTop = x2AxisDisplay == 'R' ? maxStringX2 + 15 : 10;
			var marginLeft = yAxisDisplay != 'N' ? maxStringY : 10;
			var marginRight = y2AxisDisplay != 'N' ? maxStringY2 : 10;

			if (this.X.Title) marginBottom += 20;
			if (this.X2.Title) marginTop += 20;
			if (this.Y.Title) marginLeft += 15;
			if (this.Y2.Title) marginRight += 25;

			var margin = {
				top: marginTop,
				right: marginRight,
				bottom: marginBottom,
				left: marginLeft
			};

			this.Margin = margin;
			return margin;
		};

		/**
            * Create SVG element for plot area.
            * @param {string} [before] CSS selector at which the SVG should be inserted before.
        */
		this.createSVG = function(before) {
			var margin = this.Margin;

			this.SVG = d3.select(this.Container)
				.insert("svg", before)
					.attr("width", this.Width + margin.left + margin.right) // Pad additionally for margin and legend
					.attr("height", this.Height)
				.append("g")
					.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
			return this.SVG;
		};

		/** Rotates the chart and axes 90 degrees */
		this.rotate = function() {
			this.SVG.parent().attr('width', this.Height);
			this.SVG.parent().attr('height', this.Width + this.Margin.left + this.Margin.right);
			this.SVG.attr('transform', 'translate(' + (this.Height) + ', ' + this.Margin.left + ') rotate(90)');
		}

		/** Draw axes for chart using the defined margin and scales. Values are also formatted as per the OBIEE column. */
		this.drawAxes = function() {
			var margin = this.Margin;
			var x = this.X.Scale, xCol = this.X.Column, xTitle = this.X.Title;
			var x2 = this.X2.Scale, x2Col = this.X2.Column, x2Title = this.X2.Title;
			var y = this.Y.Scale, yCol = this.Y.Column, yTitle = this.Y.Title;
			var y2 = this.Y2.Scale, y2Col = this.Y2.Column, y2Title = this.Y2.Title;
			var chart = this.SVG, width = this.Width, height = this.Height - margin.top - margin.bottom;

			if (x) {
				var xLabelDisplay = this.axisLabelDisplay('X');

				// Translate the x domain for axis labels data format
				var xDomain = x.domain();
				if (typeof (x.rangePoints) !== 'undefined' && xCol) // Ordinal scale
					x.domain(xDomain.map(function(d) { return xCol.format(d); }));

				// D3 axes functions
				var xAxis = d3.svg.axis()
					.scale(x)
					.orient("bottom");

				if (typeof (x.rangePoints) === 'undefined') { // Numerical/Date scale
					if (xCol) {
						if (xCol.DataType == 'date') {
							xAxis.tickFormat(rmvpp.multiTimeFormat); // Dynamic time axis
						} else
							xAxis.tickFormat(rmvpp.locales[xCol.Locale].numberFormat(xCol.DataFormat));
					} else
						xAxis.tickFormat(scienceFormat);
				}

				// Draw axes from functions above
				chart.append("g")
					.attr("class", "x axis")
					.attr("transform", "translate(0," + height + ")")
					.call(xAxis)

				this.Axes.X = xAxis;

				x.domain(xDomain);

				// If chart is too narrow, rotate X labels
				if (xLabelDisplay == 'R') {
					chart.selectAll(".x.axis text")
						.style("text-anchor", "end")
						.attr("dx", "-.8em")
						.attr("dy", "-.5em")
						.attr("transform", function(d) {
							return "rotate(-90)"
					});
				}

				// If elements are too narrow, remove X Labels
				if (xLabelDisplay == 'N')
					chart.selectAll(".x.axis .tick").remove();
			}

			if (x2) {
				var x2LabelDisplay = this.axisLabelDisplay('X2');

				// Translate the x domain for axis labels data format
				var x2Domain = x2.domain();
				if (typeof (x2.rangePoints) !== 'undefined' && x2Col) // Ordinal scale
					x2.domain(x2Domain.map(function(d) { return x2Col.format(d); }));

				// D3 axes functions
				var x2Axis = d3.svg.axis()
					.scale(x2)
					.orient("top");

				if (typeof (x2.rangePoints) === 'undefined') { // Numerical/Date scale
					if (x2Col) {
						if (x2Col.DataType == 'date') {
							x2Axis.tickFormat(rmvpp.multiTimeFormat); // Dynamic
						} else
							x2Axis.tickFormat(rmvpp.locales[x2Col.Locale].numberFormat(x2Col.DataFormat));
					} else
						x2Axis.tickFormat(scienceFormat);
				}

				// Draw axes from functions above
				chart.append("g")
					.attr("class", "x2 axis")
					.attr("transform", "translate(0,0)")
					.call(x2Axis)

				this.Axes.X2 = x2Axis;

				x2.domain(x2Domain);

				// If chart is too narrow, rotate X labels
				if (x2LabelDisplay == 'R') {
					chart.selectAll(".x2.axis text")
						.style("text-anchor", "start")
						.attr("dx", ".8em")
						.attr("dy", "1.2em")
						.attr("transform", function(d) {
							return "rotate(-90)"
					});
				}

				// If elements are too narrow, remove X Labels
				if (x2LabelDisplay == 'N')
					chart.selectAll(".x2.axis .tick").remove();
			}

			if (y) {
				if (yCol.Measure != 'none')
					y.range([height,0]).nice();
				var yLabelDisplay = this.axisLabelDisplay('Y');

				var yDomain = y.domain();
				if (typeof (y.rangePoints) !== 'undefined' && yCol)
					y.domain(yDomain.map(function(d) { return yCol.format(d); }));

				var yAxis = d3.svg.axis()
					.scale(y)
					.orient("left")
                    .ticks(5);

				if (typeof (y.rangePoints) === 'undefined' && yCol) { // rangePoints only exists on ordinal scale
					if (yCol)
						yAxis.tickFormat(rmvpp.locales[yCol.Locale].numberFormat(yCol.DataFormat));
					else
						yAxis.tickFormat(scienceFormat);
				}

				chart.append("g")
					.attr("class", "y axis")
					.call(yAxis);

				this.Axes.Y = yAxis;

				y.domain(yDomain);

				// If elements are too narrow, remove Y Labels
				if (yLabelDisplay == 'N')
					chart.selectAll(".y.axis .tick").remove();
			}

			if (y2Col) {
				y2.range([height,0]).nice();
				var y2LabelDisplay = this.axisLabelDisplay('Y2');

				var y2Domain = y2.domain();
				if (typeof (y2.rangePoints) !== 'undefined' && y2Col)
					y2.domain(y2Domain.map(function(d) { return y2Col.format(d); }));

				var y2Axis = d3.svg.axis()
					.scale(y2)
					.orient("right");

				if (typeof (y2.rangePoints) === 'undefined' && y2Col) { // rangePoints only exists on ordinal scale
					if (y2Col)
						y2Axis.tickFormat(d3.format(y2Col.DataFormat));
					else
						y2Axis.tickFormat(scienceFormat);
				}

				chart.append("g")
					.attr("class", "y2 axis")
					.attr("transform", "translate(" + width + ",0)")
					.call(y2Axis);

				this.Axes.Y2 = y2Axis;
				y2.domain(y2Domain);

				// If elements are too narrow, remove Y Labels
				if (y2LabelDisplay == 'N') {
					chart.selectAll(".y2.axis .tick").remove();
                }
			}

			// Add X title conditionally
			if (xTitle && x) {
				chart.select('.x.axis')
					.append("text")
					.attr("x", width / 2)
					.attr("y", margin.bottom)
					.style("text-anchor", "middle")
					.text(xTitle)
					.classed("label", true);
			}

			// Add Y title conditionally
			if (yTitle && y) {
				chart.select('.y.axis')
					.append("text")
					.attr("transform", "rotate(-90)")
					.attr("x", 0 - (height / 2))
					.attr("y", (margin.left-10)*-1)
					.style("text-anchor", "middle")
					.text(yTitle)
					.classed("label", true);
			}

			// Add Second Y title conditionally
			if (y2Title && y2) {
				chart.select('.y2.axis')
					.append("text")
					.attr("transform", "rotate(-90)")
					.attr("x", 0 - (height / 2))
					.attr("y", margin.right)
					.style("text-anchor", "middle")
					.text(y2Title)
					.classed("label", true);
			}

			// Add 0 line
			if (x && y ) {
			chart.append('line')
				.attr('class', 'zero-line')
				.attr('x1', 0)
				.attr('x2', width)
				.attr('y1', y(0))
				.attr('y2', y(0))
				.style('stroke', '#666')
				.style('shape-rendering', 'crispEdges');
			}
		}
	};

	/**
        * Creates a linear D3 scale.
        * @param {number[]} range Graphical range for the scale in pixels.
        * @param {number[]} series Data series for the scale.
    */
	rmvpp.linearScale = function(range, series) {
		var max = d3.max(series);
		var min = d3.min(series);

		var linearScale = d3.scale.linear()
			.range(range)
			.domain([min, max]);

		return linearScale;
	}

    /**
        * Retrieves an array of colours from a palette definition.
        * @param {sting|array} palette Configuration property describing the colour palette.
        * @returns {string[]} Array of hex colours for the palette chosen.
    */
    rmvpp.getPalette = function(palette) {
        return $.isArray(palette) ? palette : InsightsConfig.Palettes[palette];
    }

	/**
        * Creates a colour scale tying a group of colours to a set of values.
        * @param {string[]} series Data series in which to tie the colours to.
        * @param {string|array} palette Configuration property describing the colour palette.
        * @param {object} config BI configuration object with properties: colour1, colour2 etc.
        * @param {number} numColours Number of colours to assign.
        * @returns {function} D3 ordinal scales for the hex colours.
    */
	rmvpp.colourScale = function(series, palette) {
		var colourArray = rmvpp.getPalette(palette);
        var colourScale = d3.scale.ordinal()
			.range(colourArray)
			.domain(d3.set(series).values()); // Set the domain to unique values
		return colourScale;
	}

	/**
        * Creates a icon button with a tooltip and fading colour transition.
        * @param {DOM} container DOM element in which to render the button.
        * @param {string} icon [Font Aweeome](https://fortawesome.github.io/Font-Awesome/icons/) icon to render.
        * @param {string} caption Caption for the tooltip
        * @param {Tooltip} tooltip Tooltip object
        * @param {string} colour Colour of the icon and tooltip.
        * @param {function} [clickHandler] Function to execute on click.
    */
	rmvpp.iconButton = function(container, icon, caption, tooltip, colour, clickHandler) {
		var btn = $('<i class="fa fa-' + icon + '"></i>').mouseover(function(e) {
			d3.select(this).transition().style('color', colour);
			tooltip.displayHTML(caption, e);
		}).mouseout(function(e) {
			d3.select(this).transition().style('color', 'black');
			tooltip.hide();
		});
		if (clickHandler) { btn.click(function() { clickHandler(); }) };

		$(container).append(btn);
	};

	/**
        * Render lines from co-ordinate arrays.
        * @param {D3} path D3 selected SVG path element to assign the `d` attribtues to.
        * @param {object[]} coords Array of `x` and `y` value pairs to plot.
    */
	rmvpp.renderLine = function(path, coords) {
		var line = d3.svg.line()
			.x(function(d) { return d.x;})
			.y(function(d) { return d.y;});
        line.defined(function(d) { return !isNaN(d.y); })

		path.datum(coords)
			.attr('opacity', 1)
			.attr('d', line);
	}

	/**
        * Calculates an estimate of longest string in an array in px: assumes sans-serif, font size 10.
        * @param {string[]} Array in which check for the longest string.
        * @param {BIColumn} OBIEE column so the string can be formatted before checking.
        * @param {number} [size=10] Font size to check length for.
        * @returns {number} Length of the longest string in pixels.
    */
	rmvpp.longestString = function(array, col, size) {
		format = scienceFormat;
		size = size || 10;
		var stringConvert = array.map(function(d) {
			if (isNaN(d)) {
				if (col)
					return col.format(String(d));
				else
					return String(d);
			} else {
				if (col)
					return col.format(d);
				else
					return scienceFormat(d);
			}});

		var longString = stringConvert.sort(function (a, b) { return b.length - a.length; })[0];

        // Use a large character so it doesn't underestimate
        var placeholder = ''
        for (var i=0; i < longString.length; i++) {
            placeholder += 'M';
        }

		$('html').append('<span id="rm-string-width" style="font-family : sans-serif; font-size: ' + size + 'px;">' + placeholder + '</span>');
		var stringWidth = $('#rm-string-width').width();
		$('#rm-string-width').remove();

		return stringWidth;
	}

	/* ------ END OF PLOTTING FUNCTIONS ------ */

	/* ------ COLOUR FUNCTIONS ------ */

	/**
        * Increases colour brightness by a percentage.
        * @param {string} hexColour Hexadecimal colour code to make brighter.
        * @param {number} percent Percentage to increase the brightness by.
        * @returns {string} Hexadecimal colour with increased brightness.
    */
	rmvpp.increaseBrightness = function(hexColour, percent){
		var hsl = rgbToHSL(hexToRGB(hexColour));
		hsl[2] = d3.min([1, hsl[2] * (1+(percent/100))]);
		return rgbToHex(hslToRGB(hsl));
	}

    /**
        * Reduces colour brightness by a percentage.
        * @param {string} hexColour Hexadecimal colour code to make less bright.
        * @param {number} percent Percentage to reduce the brightness by.
        * @returns {string} Hexadecimal colour with reduced brightness.
    */
	rmvpp.reduceBrightness = function(hexColour, percent){
		var hsl = rgbToHSL(hexToRGB(hexColour));
		hsl[2] = hsl[2] * (1-(percent/100));
		return rgbToHex(hslToRGB(hsl));
	}

	/**
        * Increase colour saturation by a percentage.
        * @param {string} hexColour Hexadecimal colour code.
        * @param {number} percent Percentage to alter by.
        * @returns {string} Hexadecimal colour with increased saturation.
    */
	rmvpp.increaseSaturation = function(hexColour, percent){
		var hsl = rgbToHSL(hexToRGB(hexColour));
		hsl[1] = d3.min([1, hsl[1] * (1+(percent/100))]);
		return rgbToHex(hslToRGB(hsl));
	}

    /**
        * Reduce colour saturation by a percentage.
        * @param {string} hexColour Hexadecimal colour code.
        * @param {number} percent Percentage to alter by.
        * @returns {string} Hexadecimal colour with reduced saturation.
    */
	rmvpp.reduceSaturation = function(hexColour, percent){
		var hsl = rgbToHSL(hexToRGB(hexColour));
		hsl[1] = hsl[1] * (1-(percent/100));
		return rgbToHex(hslToRGB(hsl));
	}

    /**
        * Sets the colour brightness to a specific level.
        * @param {string} hexColour Hexadecimal colour code.
        * @param {number} brightness Integer between 1-100 indicating the new brightness with 100 the most bright.
        * @returns {string} Hexadecimal colour with altered brightness.
    */
	rmvpp.setBrightness = function(hexColour, brightness){
		var hsl = rgbToHSL(hexToRGB(hexColour));
		hsl[2] = (brightness/100);
		return rgbToHex(hslToRGB(hsl));
	}

    /**
        * Sets the colour saturation to a specific level.
        * @param {string} hexColour Hexadecimal colour code.
        * @param {number} saturation Integer between 1-100 indicating the new saturation with 100 the most bright.
        * @returns {string} Hexadecimal colour with altered saturation.
    */
	rmvpp.setSaturation = function(hexColour, saturation){
		var hsl = rgbToHSL(hexToRGB(hexColour));
		hsl[1] = (saturation/100);
		return rgbToHex(hslToRGB(hsl));
	}

	/**
        * Function to get the brightness of a colour.
        @param {string} hexColour Hexadecimal colour code.
        @returns {number} Brightness of the colour between 1 and 100.
    */
	rmvpp.getBrightness = function(hexColour) {
		return rgbToHSL(hexToRGB(hexColour))[2];
	}

    /**
        * Function to get the saturation of a colour.
        @param {string} hexColour Hexadecimal colour code.
        @returns {number} Saturation of the colour between 1 and 100.
    */
	rmvpp.getSaturation = function(hexColour) {
		return rgbToHSL(hexToRGB(hexColour))[1];
	}

	/** Convert RGB value to Hex. Expects input in 'rgb(r, g, b)' format or as a three dimensional array. */
	function rgbToHex (rgb) {
		if (typeof(rbg) == 'string') {
			re = new RegExp('rgb\\((\\d*?), (\\d*?), (\\d*?)\\)')
			var splitRGB = re.exec(rgb);
			if(splitRGB) {
				splitRGB.pop(0);
				rgb = splitRBG;
			}
		}

		return "#" + componentToHex(+rgb[0]) + componentToHex(+rgb[1]) + componentToHex(+rgb[2]);
	}

	function componentToHex(c) {
		var hex = c.toString(16);
		return hex.length == 1 ? "0" + hex : hex;
	}

	/** Convert Hex colour to RGB. */
	function hexToRGB(hex) {
		var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? [
			parseInt(result[1], 16),
			parseInt(result[2], 16),
			parseInt(result[3], 16)
		] : null;
	}

	/** Convert RGB colour to HSL. */
	function rgbToHSL(rgb){
		var r = rgb[0], g = rgb[1], b = rgb[2];
		r /= 255, g /= 255, b /= 255;
		var max = Math.max(r, g, b), min = Math.min(r, g, b);
		var h, s, l = (max + min) / 2;

		if(max == min){
			h = s = 0; // achromatic
		}else{
			var d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch(max){
				case r: h = (g - b) / d + (g < b ? 6 : 0); break;
				case g: h = (b - r) / d + 2; break;
				case b: h = (r - g) / d + 4; break;
			}
			h /= 6;
		}

		return [h, s, l];
	}

	/** Convert HSL colour to RGB */
	function hslToRGB(hsl){
		var r, g, b;
		var h = hsl[0], s = hsl[1], l = hsl[2];

		if(s == 0){
			r = g = b = l; // achromatic
		} else {
			var hue2rgb = function hue2rgb(p, q, t){
				if(t < 0) t += 1;
				if(t > 1) t -= 1;
				if(t < 1/6) return p + (q - p) * 6 * t;
				if(t < 1/2) return q;
				if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
				return p;
			}

			var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			var p = 2 * l - q;
			r = hue2rgb(p, q, h + 1/3);
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - 1/3);
		}

		return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
	}

	/**
        * Apply colours as properties to data frame based on conditional format rules.
        * @param {object[]} data An array of objects, usually the result set of an OBIEE query.
        * @param {object} columnMap `BIColumn` mappings to attributes in the query and result set.
        * @param {function} colourScale D3 scale mapping colours to categories in the data.
        * @param {BIConditionalFormat[]} condFormats Conditional format objects to compare and apply style.
        * @param {string} category Property in the dataset containing descriptive OBIEE data.
        * @param {string} measure Property in the dataset containing aggregated value data.
        * @param {string} [vary] Property indicating if  the chart has been varied by colour.
    */
	rmvpp.applyColours = function(data, columnMap, colourScale, condFormats, category, measure, vary) {
		data.forEach(function(row) {
			row[measure].forEach(function(m, i) {
				if (m[vary])
					i = 0;

				m.measureName = columnMap[measure][i].Name;
				m.colour = getColour(row, m, colourScale, condFormats, category, measure);
			});
		});
	}

	/**
        * Creates a mono-hued gradient colour scale from a minimum and maximum value.
        * @param {string} colour Hexadecimal colour for which to theme the scale around.
        * @param {number} min Minimum numeric value for the lightest colour.
        * @param {number} max Maximum numeric value indicating the darkest colour.
        * @param {function} D3 linear scale tying a numeric range to a gradient of colours.
    */
	rmvpp.gradientColour = function(colour, min, max) {
		var minColour = rmvpp.setBrightness(colour, 80);
		var maxColour = rmvpp.setBrightness(colour, 20);

		return d3.scale.linear()
			.domain([min, (min+(max-min)/2), max])
			.range([minColour, colour, maxColour]);
	}

	/** Check conditional formats for a data cell and assign a colour if necessary. */
	function getColour(row, datum, colourScale, condFormats, category, measure) {

		var colour = colourScale(datum.name); // Colour based on the name attribute of the datum

		// Formats based on hidden columns
		function hiddenFormat(cf, row, datum) {
			var colour;
			if ('hidden' in row) { // Handles denormalisation of hidden attribute by rmvpp.pivotData
				if (row['hidden']) {
					if (cf.compare(row['hidden'][cf.sourceIndex()].value))
						colour = cf.Style.colour;
				}
			} else {
				if (datum['hidden']) {
					if (cf.compare(datum['hidden'][cf.sourceIndex()].value))
						colour = cf.Style.colour;
				}
			}
			return colour;
		}

		// Cater for rules against all measures
		var filterCF = condFormats.filter(function(cf) { return cf.TargetID == measure; });
		filterCF.forEach(function(cf) {
			if (cf.SourceID == category) { // Branch depending on whether rule is on category or measure
				if (cf.compare(datum[category]))
					colour = cf.Style.colour;
			} else if (cf.SourceID == measure) { // Single measure column
				if (cf.compare(+datum.value))
					colour = cf.Style.colour;
			} else if (cf.SourceID.indexOf('hidden') == 0) { // Handles formatting on hidden column
				colour = hiddenFormat(cf, row, datum) || colour;
			} else { // Multiple measure column
				if (cf.compare(row[cf.sourceProperty()][cf.sourceIndex()].value))
					colour = cf.Style.colour;
			}
		});

		// Cater for rules against specific measures
		var filterCF = condFormats.filter(function(cf) { return cf.TargetName == datum.measureName;});
		filterCF.forEach(function(cf) {
			if (cf.SourceID == category) { // Branch depending on whether rule is on category or measure
				if (cf.compare(datum[category]))
					colour = cf.Style.colour;
			} else if (cf.SourceID.indexOf('hidden') == 0) { // Cater for hidden attributes
				colour = hiddenFormat(cf, row, datum) || colour;
			} else {
				if (cf.compare(row[cf.sourceProperty()][cf.sourceIndex()].value))
					colour = cf.Style.colour;
			}
		});
		return colour;
	}

	/* ------ END OF COLOUR FUNCTIONS ------ */

	/* ------ TOOLTIP CLASS ------ */

    /**
        * @class
        * Tooltip positioned using mouse events and DOM elements that can display information
        * in a number of different ways.
        * @param container Container DOM element in which to create the tooltip.
    */
	rmvpp.Tooltip = function(container) {
        /** Container DOM element in which to create the tooltip. */
		this.Container = container;

		/** Creates the HTML elements for the tooltip. */
		this.create = function() { // Create HTML div
			d3.select(this.Container).selectAll('.tooltip').remove(); // Remove old tooltip
			return d3.select(this.Container)
				.append('div')
				.classed('tooltip', true)
                .classed('do-not-print', true)
				.style('display', 'none');
		}

        /** HTML element of the tooltip itself. */
		this.Element = this.create();

		/** Hides the tooltip using a fade animation. */
		this.hide = function() {
			$(this.Element[0]).stop().fadeOut(200);
		}

		/**
            * Display and position tooltip displaying data in a list format for an XY plot space.
		    * Displays one or measure values as a list in the tooltip for comparison.
            * @param {object} datum Object with data for all of the measures. Expects measure properties to be arrays
            * of objects with properties `name` and `value`.
            * @param {string} category Property name for the category (dimension) attribute in the datum.
            * @param {string[]} measures One or more property names indicating the measures in the datum.
            * @param {event} event Mouse event fired when displaying the tooltip.
            * @param {function} colourScale D3 scale including the colours that should be tied to the categories.
            * @param {string} highlight Name of the measure in which to higlight. Will display the number in bold and
            * changes the colour of the border of the tooltip.
        */
		this.displayList = function(datum, category, measures, columnMap, event, colourScale, highlight, overridePos) {
			highlight = highlight || false;
			$(this.Element[0]).empty().stop().fadeIn(200);
			var list = this.Element.append('ul');

			if (!$.isArray(measures)) measures = [measures];

			var allValues = [];
			measures.forEach(function(measure) {
				var elements = list.selectAll('li' + '.' + measure)
					.data(datum[measure])
					.enter()
					.append('li')
					.classed(measure, true);

				// Generate mini legend and values
				elements.append('div').classed('legend', true).style('background', function(d) {
					if (typeof(colourScale) == 'string')
						return d[colourScale];
					else
						return colourScale(d.name);
				});
				elements.append('span')
					.text(function(d, i) {
						allValues.push(+d.value);
						var formatValue = columnMap[measure][i] ? columnMap[measure][i].format(d.value) : columnMap[measure][0].format(d.value);
						return formatValue;
					})
					.style('font-weight', function(d) {
						if (d.name == highlight) return 'bold';
						else return 'normal';
					});
			});

			var header = list.insert('li', ':first-child');
			header.append('b').text(columnMap[category].format(datum[category]));

			var measureType = rmvpp.convertMeasure(columnMap[measures[0]][0].Measure); // Assume all have the same aggregation type
			var total = columnMap[measures[0]][0].format(d3[measureType](allValues));
            if (measures.length > 1) // Show a total if there's more than one measure
                list.append('li').append('b').text(total);

			if (!overridePos) {
				var offset = rmvpp.getOffset(event, this.Container);
				this.position(offset.X, offset.Y);
			}
		};

		/**
            * Display tooltip with the full set of information from a datum.
			* @param {string[]} tooltipCols List of properties for which to display the tooltip data.
			* @param {object} columnMap Column map object containing the BIColumn objects for each column in the visualisation.
			* @param {object} datum Datum containing the information to display.
			* @param {event} event Mouse event fired when displaying the tooltip.
        */
		this.displayFull = function(tooltipCols, columnMap, datum, event) {
			$(this.Element[0]).empty().stop().fadeIn(200); // Display tooltip
			var offset = rmvpp.getOffset(event, this.Container);

			// Populate tooltip with content
			var list = this.Element.append('ul');
			tooltipCols.forEach(function(col) {
                if (columnMap[col].Code) { // If column is defined
    				var listItem = list.append('li');
    				listItem.append('b').text(columnMap[col].Name + ': ');
    				listItem.append('span').text(function() {
    					return columnMap[col].format(datum[col]);
    				});
                }
			});

			var offset = rmvpp.getOffset(event, this.Container);
			this.position(offset.X, offset.Y);
		};

		/**
			* Display tooltip with any HTML as input.
			* @param html HTML to render in the tooltip.
			* @param {event} event Mouse event fired when displaying the tooltip.
            * @param {boolean} overridePos If specified as true, the function will *not* position the tooltip.
            * Instead, it us up to the developer to ensure the tooltip is correctly positioned
		*/
		this.displayHTML = function(html, event, overridePos) {
			$(this.Element[0]).empty().stop().fadeIn(200); // Display tooltip
			this.Element.append('div').html(html);

			if (!overridePos) {
				var offset = rmvpp.getOffset(event, container);
				this.position(offset.X, offset.Y);
			}
		};

		/**
			* Update the text/html of a tooltip without changing colour or position.
			* @param html HTML to update the tooltip with.
		*/
		this.updateText = function(html) {
			this.Element.select('div').html(html);
		}

		/**
			* Move tooltip on the screen using an animation.
			* @param {number} offsetX Horizontal position in pixels to set as the `left` CSS property..
			* @param {number} offsetY Vertical position in pixels to set as the `top` CSS property.
		*/
		this.position = function(offsetX, offsetY) {
			this.Element.transition()
				.style("top",(offsetY)+"px").style("left",(offsetX)+"px") // Position tooltip
				.duration(100);
		}
	};

	/**
		* Get X and Y offset based on mouse event and DOM element. Specifically written to cope with visualisations which
		* should move the tooltip consistently across browsers due to the positioning of the HTML containers.
		* @param {event} event Mouse event fired when displaying the tooltip.
		* @param {DOM} container HTML container element of the mouse event from which to derive the screen position.
		* @returns {object} Has properties `X` and `Y` with derived coordinates.
	*/
	rmvpp.getOffset = function(event, container) {
		var offset = {}, parentContainer = $(container).parents('.visualisation').length > 0 ? $(container).parents('.visualisation') : $(container);
		offset.X = event.pageX - parentContainer.position().left + 10;
		offset.Y = event.pageY - parentContainer.position().top; // Use pageX as it is supported on IE as well. Subtract the position of the container
		return offset;
	}

	/* ------ END OF TOOLTIP CLASS ------ */

	/* ------ LEGEND CLASS ------ */

	/**
		* @class
		* Creates and manages properties of an SVG legend.
		* @param {D3} D3 selected SVG element of the chart in which the legend should be rendered.
		* @param {string[]} keys Legend keys to be included.
		* @param {string} title Title for the legend.
		* @param {number} chartWidth Width of the chart.
		* @param {object} margin Margin of the chart so that the legend can be placed correctly.
	*/
	rmvpp.Legend = function(chart, keys, title, chartWidth, margin) {
		/** Parent container element of the SVG. */
		this.Container = chart.parent();

		/** Legend keys to be included. */
		this.Keys = keys;

		/** Title for the legend. */
		this.Title = title;

		/** Width of the chart. */
		this.ChartWidth = chartWidth;

		/** Margin of the chart. */
		this.ChartMargin = margin;

		/** Width of the container. */
		this.ContainerWidth = 0;

		/** Height of the container. */
		this.ContainerHeight = 0;

		/** Creates the SVG elements for the legend. */
		this.create = function() {
			this.Container.selectAll('.legend').remove(); // Remove legend if it exists
			var maxString = rmvpp.longestString(this.Keys.concat([this.Title]));

			// Make chart parent container wider to match the widest legend element
			this.ContainerWidth = +this.Container.attr('width');
			this.Container.attr('width', this.ContainerWidth + maxString);

			var legendContainer = chart.append('g')
				.attr('transform', 'translate(' + ((this.ChartWidth + maxString)) + ', 0)')
				.classed('legend', true);

			legendContainer.append('g')
				.attr('transform', 'translate(0,0)')
				.append('text')
					.classed('title', true)
					.text(this.Title);

			return legendContainer;
		}

		/** Rotate the legend 90 degrees. */
		this.rotate = function() {
			var margin = this.ChartMargin;
			var maxString = rmvpp.longestString(this.Keys.concat([this.Title]));
			var extendWidth = maxString + 25 + margin.right + margin.left;

			// Make chart parent container wider to match the widest legend element
			this.ContainerWidth = +this.Container.attr('width');
			this.Container.attr('width', (this.ContainerWidth + extendWidth + margin.top));
			this.Container.select('g.legend').attr('transform', 'translate(0, -' + extendWidth + ') rotate(-90)');
		}

        /** Reposition legend for circular charts */
        this.repositionCircular = function() {
            // Reposition because of circular offset
    		var transform = d3.transform(this.Element.attr('transform'));
    		transform.translate[1] = (this.ChartWidth-10)*-1;
    		this.Element.attr('transform', 'translate(' + transform.translate.toString() + ')');
        }

        /** HTML element of the legend itself. */
		this.Element = this.create();

		/**
			* Add a colour key to legend.
			* @param {string[]} colourCols List of items to add to the key.
			* @param {function} D3 scale mapping colours to the items in the first argument.
		*/
		this.addColourKey = function(colourCols, colourScale) {
			var yMargin = getLegendKeyOffset(this.Element);

			// Legend elements
			var key = this.Element.selectAll(".element")
				.data(colourCols.slice())
			.enter().append("g")
				.attr("transform", function(d, i) { return "translate(" + 0 + "," + (yMargin + (+i * 20)) + ")"; })
				.classed('key', true)

			key.append("rect")
				.attr("x", 0 - 18)
				.attr("width", 18)
				.attr("height", 18)
				.style("fill", colourScale);

			key.append("text")
				.attr("x", 0 - 24)
				.attr("y", 9)
				.attr("dy", ".35em")
				.style("text-anchor", "end")
				.text(function(d) { return d; });
		};

		/**
			* Add size key to legend to show a variable change in size of points.
			* @param {string} sizeName Name for the size key.
			* @param {function} sizeScale D3 scale for using to draw the scaled circles.
		*/
		this.addSizeKey = function(sizeName, sizeScale) {
			// Position elements in legend
			var yMargin = getLegendKeyOffset(this.Element);

			// Legend elements
			var key = this.Element.append("g")
				.classed('key', true)
				.attr("transform", "translate(0, " + yMargin + ")");

			// Heading
			key.append("text")
				.attr("x", 0 )
				.attr("y", 9)
				.attr("dy", ".35em")
				.style("text-anchor", "end")
				.text(sizeName);

			// Use scales for displaying the key
			var sizeScale = sizeScale.copy();
			sizeScale.domain([1,4]);

			var posRange = d3.scale.linear()
				.domain([1,4])
				.range([10 + (this.Element.node().getBBox().width * -1), sizeScale.range()[1] * -1])

			// Draw 4 circles of increasing size
			key.selectAll('g')
				.data([1,2,3,4]).enter()
				.append('circle')
					.attr('r', function(d) {return sizeScale(d);})
					.attr('cx', function(d) {return posRange(d);})
					.attr('cy', 20 + (+sizeScale.range()[1]));
		};

		/**
			* Add keys to the legend for conditional format rules.
			* @param {BIConditionalFormat[]} Array of conditional format objects to add to the legend.
			* @param {object} Column map object with the BIColumns used in the visualisation.
		*/
		this.addCondFormatKey = function(condFormats, columnMap) {
			if (condFormats.length > 0) {
				var yMargin = getLegendKeyOffset(this.Element);

				// Adjust width of chart to compensate for conditional format
				var maxString = rmvpp.longestString(condFormats.map(function(cf) { return cf.SourceName + ' ' + obiee.operatorToText(cf.Operator) + ' ' + cf.Value; }).concat(['Conditional Formatting']), false, 8);
				this.Container.attr('width', this.ContainerWidth + maxString);
				this.Container.select('.legend').attr('transform', 'translate(' + ((this.ChartWidth + maxString)) + ', 0)');

				// Legend elements
				var title = this.Element.append("g")
					.classed('key', true)
					.attr("transform", "translate(0, " + yMargin + ")");

				// Heading
				title.append("text")
					.attr("x", 0 )
					.attr("y", 9)
					.attr("dy", ".35em")
					.style("text-anchor", "end")
					.style('font-weight', 'bold')
					.text('Conditional Format');

				// Legend elements
				var key = this.Element.selectAll(".element")
					.data(condFormats)
				.enter().append("g")
					.attr("transform", function(d, i) { return "translate(" + 0 + "," + (yMargin + ((i+1) * 20)) + ")"; })
					.classed('key', true);

				key.append("rect")
					.attr("x", 0 - 18)
					.attr("width", 18)
					.attr("height", 18)
					.style("fill", function(d) { return d.Style.colour; });

				key.append("text")
					.attr("x", 0 - 24)
					.attr("y", 9)
					.attr("dy", ".35em")
					.style("text-anchor", "end")
					.text(function(d) { return (d.SourceName + ' ' + obiee.operatorToText(d.Operator) + ' ' + d.Value); });
			}
		}
	};

	/** Get y offset of lowest key group (g) elements. */
	function getLegendKeyOffset(legendContainer) {
		var lastGroup = legendContainer.selectAll('g.key').last(), yMargin = 5;
		if (lastGroup[0][0]) {
			var translate = d3.transform(lastGroup.attr('transform')).translate;
			yMargin = yMargin + lastGroup.node().getBBox().height + translate[1];
		}
		return yMargin;
	}

	/* ------ END OF LEGEND CLASS ------ */

	/* ------ SELECT BOX CLASS ------ */

	/**
		* Draws a rectangular selection box on an SVG element. Allows callbacks for various mouse events.
		* @param {D3} svg D3 selected SVG element on which to draw the box.
		* @param {function} mouseDown Callback function executed whilst the mouse is pressed down.
		* @param {function} mouseMove Callback function executed when the mouse is moved.
		* @param {function} mouseUp Callback function executed when the mouse button is released.
		* @param {boolean} reDraw If set to true, the box will automatically redraw irrespective of the callback functions.
	*/
	rmvpp.selectBox = function(svg, mouseDown, mouseMove, mouseUp, reDraw) {
		svg.on('mousedown', function() {
			var mouseX = d3.mouse(this)[0];
			var mouseY = d3.mouse(this)[1];

			d3.event.preventDefault();
			svg.append( "rect")
				.attr({
					class   : "selectionBox",
					x       : mouseX,
					y       : mouseY,
					width   : 0,
					height  : 0
				});

			mouseDown();
		})
		.on( "mousemove", function() {
			var selectBox = svg.select( "rect.selectionBox");

			if(!selectBox.empty()) {
				var attrs = boxAttrs(selectBox, this);
			    if (!reDraw)
					selectBox.attr(attrs); // Alter selection box
				mouseMove(attrs, selectBox);
			}
		})
		.on('mouseup', function() {
			var selectBox = svg.select( "rect.selectionBox");
			var attrs = boxAttrs(selectBox, this);
			mouseUp(attrs, selectBox);
			svg.selectAll( "rect.selectionBox").remove();
		});

		// Get box attributes based on mouse movement
		function boxAttrs(selectBox, event) {
			var	mouseX = d3.mouse(event)[0],
				mouseY = d3.mouse(event)[1],
				attrs = { x : 0, y : 0, width : 0, height: 0 };

			if (!selectBox.empty()) {

				// Rectangle attributes
				attrs = {
					x       : parseInt( selectBox.attr( "x"), 10),
					y       : parseInt( selectBox.attr( "y"), 10),
					width   : parseInt( selectBox.attr( "width"), 10),
					height  : parseInt( selectBox.attr( "height"), 10)
				};
				var move = { // Move position
					x : mouseX - attrs.x,
					y : mouseY - attrs.y
				};

				// Handle attributes for certain positions;
				if( move.x < 1 || (move.x * 2 < attrs.width)) {
					attrs.x = mouseX;
					attrs.width -= move.x;
				} else
					attrs.width = move.x;

				if( move.y < 1 || (move.y * 2 < attrs.height)) {
					attrs.y = mouseY;
					attrs.height -= move.y;
				} else
					attrs.height = move.y;
			}
			return attrs;
		}


	}

	/* ------ END OF SELECT BOX CLASS ------ */


	/* ------ UI FUNCTIONS ------ */

	/**
		* Render a spinning loading icon with some text in a given HTML container.
		* @param {DOM} container HTML container to render the loading animation in.
		* @param {string} colour Colour of the spinning loading icon.
		* @param {string} text Text to display underneath the loading icon.
	*/
	rmvpp.loadingScreen = function(container, colour, text) {
		colour = colour || '#2CC75A';
		text = text || '';
		$(container).append($('<div class="loading"></div>')
			.append('<i style="color: ' + colour + ';" class="fa fa-circle-o-notch fa-spin fa-3x"></i>')
			.append('<div style="margin-top: 5px;">' + text + '</div>')
		);
	}

	/* ------ END OF UI FUNCTIONS ------ */

	/* ------ DATA FRAME FUNCTIONS ------ */

	/**
		* Pivot data by grouping rows but splitting measures by a given attribute. Expects a single measure in an array to be present in the dataset.
		* Output data will have fewer elements, but each element will have multiple measures.
		* @param {object[]} data Array of objects describing the dataset. Expects the default dataset passed to the visualisation's `render` function.
		* @param {object} columnMap Object with `BIColumn` definitions of each column in the visualisation.
		* @param {string} pivotCol Property name of the column about which to pivot the data. These values will be denormalised as measures in the dataset.
		* @param {string} keyCol Property name of the column to be used as the key, so each element in the dataset will be of this granularity.
		* @param {string} valueCol Property name of the measure column in the dataset.
		* @param {string[]} denormCols Array of properties of columns to stamp on the granular layers of the output dataset.
		* @returns {object} Has properties `data` with the new pivoted dataset, and `colNames` which contains the new column names for measures after pivoting.
	*/
	rmvpp.pivotData = function(data, columnMap, pivotCol, keyCol, valueCol, denormCols) {
		if (columnMap[valueCol].length > 1)
			throw 'Cannot pivot data and retain a similar format when more than one measure is present.';

		var colNames = [], output = {};
		denormCols = denormCols || [];
		nestDenorm = denormCols.concat([keyCol, pivotCol]);

		var nester = d3.nest() // Pivot data frame
			.key(function(d) { return d[keyCol];})
			.key(function(d) { return d[pivotCol];});

		var nest = nester.entries(data), newFrame = [];

		// Loop over vary by colour keys
		nest.forEach(function(n) {
			var el = {};
			el[keyCol] = n.key;
			el[valueCol] = [];
			n.values.forEach(function(v) {
				var yVal = {};
				colNames.push(v.key);

				yVal['name'] = v.key;
				yVal['value'] = v.values[0][valueCol][0].value;

				nestDenorm.forEach(function(c) { yVal[c] = v.values[0][c]; }); // Denormalise columns to lowest granularity
				el[valueCol].push(yVal);
			});
			newFrame.push(el);
		});
		data = newFrame;

		colNames = d3.set(colNames).values();

		// Cope with missing values in the data frame (assign 0)
		data.forEach(function(d) {
			if (colNames.length != d[valueCol].length) {
				var valueNames = d[valueCol].map(function(d) { return d.name; });
				var diff = colNames.filter(function(i) {return valueNames.indexOf(i) < 0;})
				diff.forEach(function(n) {
					var nullObj = {};
					nullObj[keyCol] = d[keyCol];
					nullObj[pivotCol] = n;
					nullObj.name = n;
					nullObj.value = 0;
					denormCols.forEach(function(c) { nullObj[c] = d[c]; }); // Denormalise columns to lowest granularity
					d[valueCol].push(nullObj);
				});
			}
			d[valueCol] = d[valueCol].sort(function(a, b) { return d3.ascending(a.name, b.name) });
		});

		// Sort column names
		colNames = colNames.sort(function(a,b) { return d3.ascending(a,b); })

		output.colNames = colNames;
		output.data = data;
		return output; // Return object with data and new column array
	}

	/**
		@deprecated
		* Assign sort indices to dimension attributes from the original dataset received from OBIEE. Uses reserved property `rmSort`
		* Can be used to cater for 'Sort by Another Column' feature in OBIEE.
		* This has since been deprecated in favour of obtaining column properties before query execution.
		* @param {object[]} data Array of objects received from OBIEE and passed to the visualisation.
		* @param {object} columnMap Object of `BIColumn` objects describing the column mapping between OBIEE and the visualisation.
		* @returns {object[]} Modified dataset including the new property `rmSort` which can be used to sort data items based on the sort key from OBIEE.
	*/
	rmvpp.sortIndices = function(data, columnMap) {
		var exists = {};
		for (col in columnMap) {
			exists[col] = [];
			if (Object.prototype.toString.call( columnMap[col] ) === '[object Array]' ) { // Check for multiple column maps
				columnMap[col].forEach(function(c, i) {
					exists[col][i] = [];
				});
			}
		};

		data.forEach(function(d, i) {
			d.rmSort = {};
			for (col in columnMap) {
				d.rmSort[col] = [];
				if (Object.prototype.toString.call( columnMap[col] ) === '[object Array]' ) { // Check for multiple column maps
					columnMap[col].forEach(function(c, j) {
						var val = d[col][j].value;
						if ($.inArray(val, exists[col][j]) == -1)
							exists[col][j].push(val);

						if (columnMap[col][j].HasSortKey != false) { // Only apply to attributes with a sort key
							d.rmSort[col][j] = exists[col][j].indexOf(val);
						} else {
							if (columnMap[col][j].DataType == 'varchar')
								d.rmSort[col][j] = val;
							else
								d.rmSort[col][j] = +val;
						}
					});
				} else {
					var val = d[col];
					if ($.inArray(val, exists[col]) == -1)
						exists[col].push(val);

					if (columnMap[col][j].HasSortKey != false) // Only apply to attributes with a sort key
						d.rmSort[col] = exists[col].indexOf(val);
					else {
						if (columnMap[col].DataType == 'varchar')
							d.rmSort[col] = val;
						else
							d.rmSort[col] = +val;
					}
				}
			}
		});

		return data;
	}

	/**
		* Sort data based on a sort object, column map and dataset.
		* @param {object[]} data Array of objects received from OBIEE and passed to the visualisation.
		* @param {object} columnMap Object of `BIColumn` objects describing the column mapping between OBIEE and the visualisation.
		* @param {object} sort Has the property `col` which is an integer index of the column to use with 0 referring to `columnMap.category` and higher numbers
		* referring to measures as `columnMap.measure[sort.col]`. The `dir` property takes either `asc` or `desc` indicating the sort direction.
		* @returns {object[]} Sorted dataset.
	*/
	rmvpp.sortData = function (data, columnMap, sort) {
		// Sort data based on input
		sort.col = +sort.col;
		switch(sort.dir) {
			case ('asc'):
				if (sort.col != 0)
					data = data.sort(function(a, b) { return d3.ascending(+a.measure[sort.col-1].value, +b.measure[sort.col-1].value); });
				else
					data = data.sort(function(a, b) {
						if (columnMap.category.SortKey)
							return d3.ascending(+a[columnMap.category.Name + ' (Sort)'], +b[columnMap.category.Name + ' (Sort)']);
						else
							return d3.ascending(a.category, b.category);
					});
				break;
			case ('desc'):
				if (sort.col != 0)
					data = data.sort(function(a, b) { return d3.descending(+a.measure[sort.col-1].value, +b.measure[sort.col-1].value); });
				else
					data = data.sort(function(a, b) {
						if (columnMap.category.SortKey)
							return d3.descending(+a[columnMap.category.Name + ' (Sort)'], +b[columnMap.category.Name + ' (Sort)']);
						else
							return d3.descending(a.category, b.category);
					});
				break;
		}
		return data;
	}

	/**
		* Displays a standard error message
		* @param {DOM} container HTML element in which to render the error.
		* @param {string} errorMsg Error message to display.
	*/
	rmvpp.displayError = function(container, errorMsg) {
		$(container).empty();
		var errorBox = d3.select(container).append('div').classed('error', true);
		errorBox.append('span').attr('class', 'fa fa-times-circle').style('margin-right', '5px');
		errorBox.append('span').html(errorMsg.replace(/\n/g, '<br/>'));
		throw errorMsg;
	}

	/**
		* Create an object of sorted unique dimension attributes which can be useful when pivoting datasets. The values
		* for each attribute are sorted alphabetically.
		* @param {object[]} data Array of objects received from OBIEE and passed to the visualisation.
		* @param {object} columnMap Object of `BIColumn` objects describing the column mapping between OBIEE and the visualisation.
		* @returns {object} Has properties as the names of each column containing a sorted array of each unique value.
	*/
	rmvpp.uniqueDims = function(data, columnMap) {
		var sortedAttrs = {};

		for (c in columnMap) {
			if (Object.prototype.toString.call( columnMap[c] ) === '[object Array]' ) { // Check for multiple column maps
				columnMap[c].forEach(function(col) {
					if (col.Measure == 'none')
						sortedAttrs[col.Name] = [];
				});
			} else {
				var col = columnMap[c];
				if (col.Measure == 'none')
					sortedAttrs[col.Name] = [];
			}
		}

		data.forEach(function(d, i) {
			for (col in sortedAttrs) {
				if ($.inArray(d[col], sortedAttrs[col]) == -1)
					sortedAttrs[col].push(d[col]);
			}
		});

		return sortedAttrs;
	}

	/**
		* Aggregates measures in the dataset by a specific column.
		* @param {object[]} data Array of objects received from OBIEE and passed to the visualisation.
		* @param {string[]} Array of key columns by which to aggregate the data.
		* @param {string} Property name of the measure to aggregate.
		* @param {string|BIColumn} [method='sum'] Aggregates the dataset by the method chosen, defaulting to sum.
	*/
	rmvpp.aggregateData = function(data, keys, measure, method) {
		method = method || 'sum';
        if (method.Measure)
            method = rmvpp.convertMeasure(method.Measure);

		var nest = d3.nest();

		keys.forEach(function(key) {
			nest.key(function(d) { return d[key];})
		});

		nest.rollup(function(d) {
			return d3[method](d, function(g) {return +g[measure]; });
		});

		return nest.entries(data);
	}

	/**
		* Convert OBIEE measure type to the equivalent d3 aggregation property.
		* @param {string} measure OBIEE measure property.
		* @returns {string} D3 aggregation property that can be used as `d3[measure]`.
	*/
	rmvpp.convertMeasure = function(measure) {
		var outMeasure;
		switch(measure) {
			case 'avg':
				outMeasure = 'mean';
				break;
			default:
				outMeasure = 'sum';
				break;
		}
		return outMeasure;
	}

	/**
		* Get JavaScript date from a string, assuming certain formats.
		* @param {string} str Date string to convert.
		* @param {string} [format='uk'] Date format to convert from: e.g. `uk` as dd/mm/yyyy.
		* @returns {Date} JavaScript date object.
	*/
	rmvpp.toDate = function (str, format) {
		format = format || 'uk';
		var date;

		switch(format) {
			case 'uk':
				var re = new RegExp('(\\d*?)\/(\\d*?)\/(\\d\\d\\d\\d)');
				day = +re.exec(str)[1], month = +re.exec(str)[2], year = +re.exec(str)[3]
				date = new Date(year, month-1, day);
				break;
		}

		return date;
	}

	/**
		* Create date array of JavaScript date objects between two JavaScript dates with a day as the granularity.
		* @param {Date} startDate Start of the array.
		* @param {Date} endDate End of the array.
		* @returns {Date[]} Array of dates between the range.
	*/
	rmvpp.dateRange = function(startDate, stopDate) {
		startDate.setHours(12); stopDate.setHours(12); // Prevents errors with daylight savings
		var dateArray = new Array();
		var currentDate = startDate;

		while (currentDate.getTime() <= stopDate.getTime()) {
			var insertDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
			dateArray.push(insertDate);
			currentDate = currentDate.addDays(1);
		}
		return dateArray;
	}

	/**
		* Filter dataset based on D3 brush extent co-ordinates and a D3 scale function.
		* @param {object[]} data Original dataset to filter.
		* @param {number} lower Beginning of the filter range.
		* @param {number} upper End of the filter range.
		* @param {function} D3 scale object for the brush axis.
		* @returns {object[]} Filtered dataset for the given range.
	*/
	rmvpp.filterOrdinalScale = function(data, lower, upper, scale) {
		var testFilter = scale.range().filter(function(d) { return (d) <= upper && (d + scale.rangeBand()) >= lower; });
		var positions = testFilter.map(function(d) { return scale.range().indexOf(d); });
		var selected = data.filter(function(d, i) { return $.inArray(i, positions) > -1;});
		return selected;
	}

	/* ------ DATA FRAME FUNCTIONS ------ */

	/* ------ INTERACTION FUNCTIONS ------ */

	/**
		* Triggers an interaction event from a visualisation that can be listend to by one or more other visualisations on the page.
		* Data can be passed via this event to provide data driven interactivity. This function formats the datum so it can be interpreted
		* correctly by a target listening to the event.
		* @param {string} pluginName ID of the plugin in which to create the trigger for.
		* @param {object} columnMap Object of `BIColumn` objects describing the column mapping between OBIEE and the visualisation.
		* @param {DOM} container Containing HTML element for the visualisation with the trigger.
		* @param {string} event Name of the event for the interaction. This should match the equivalent `trigger` property on the plugin's `actions` item.
		* @param {object} datum Datum to pass from the source visualisation to the target via this event.
        * The function expects one or more data in the standard format as provided to the `render` function of a plugin.
	*/
	rmvpp.createTrigger = function(pluginName, columnMap, container, event, datum) {
		var properties = rmvpp.Plugins[pluginName].actions.filter(function(d) { return d.trigger == event; })[0].output; // Get columns for action from the plugin itself
		var intMap = rmvpp.actionColumnMap(properties, columnMap, datum);
		$(container).trigger(event, intMap);
	}

	/**
		Returns a column object in a specific format to be transmitted via visualisation interaction events.
		* @param {string[]} properties Array of column property names that should be passed by the interaction.
		* @param {object} columnMap Object of `BIColumn` objects describing the column mapping between OBIEE and the visualisation.
		* @param {object} datum Datum to pass from the source visualisation to the target via this event.
		* @param {object[]} Array of data objects to pass through the interaction event.
	*/
	rmvpp.actionColumnMap = function(properties, columnMap, datum) {
		var obj = [];

		// Accept single objects or arrays
		if (!$.isArray(datum))
			datum = [datum];

		properties.forEach(function(prop) { // Loop through properties
			datum.forEach(function(d) {
				if (!$.isArray( columnMap[prop] )) // Single properties
					obj.push({'id' : prop, 'col' : columnMap[prop], 'value' : d[prop]});
				else {
					columnMap[prop].forEach(function(col, i) { // Multiple properties
                        obj.push({'id' : prop + i, 'col' : col, 'value' : d[prop][i].value});
					});
				}
			});
		})
		return [obj];
	}

	/* ------ INTERACTION FUNCTIONS ------ */

	/* ------ STATISTICS FUNCTIONS ------ */

	rmvpp.stats = {};

	/**
		* Basic linear regression fowlloing `y = mx + c`, returning the slope, intercept and R^2 value.
		* @param {number[]} x Array of values for the X axis.
		* @param {number[]} Y Array of values for the Y axis.
		* @returns {object} Has properties: `slope`, `intercept` and `r2` describing the regression line.
	*/
	rmvpp.stats.linearRegression = function(x, y){
		var lr = {};
		var n = y.length;
		var sum_x = 0, sum_y = 0, sum_xy = 0, sum_xx = 0, sum_yy = 0;

		for (var i = 0; i < y.length; i++) {
			sum_x += x[i];
			sum_y += y[i];
			sum_xy += (x[i]*y[i]);
			sum_xx += (x[i]*x[i]);
			sum_yy += (y[i]*y[i]);
		}

		lr['slope'] = (n * sum_xy - sum_x * sum_y) / (n*sum_xx - sum_x * sum_x);
		lr['intercept'] = (sum_y - lr.slope * sum_x)/n;
		lr['r2'] = Math.pow((n*sum_xy - sum_x*sum_y)/Math.sqrt((n*sum_xx-sum_x*sum_x)*(n*sum_yy-sum_y*sum_y)),2);

		return lr;
	};

	/* ------ END OF STATISTICS FUNCTIONS ------ */

	/* ------ GENERIC JAVASCRIPT FUNCTIONS ------ */

	/**
		* Get [query string](https://en.wikipedia.org/wiki/Query_string) variable from the URL by name.
		* @param {string} name Name of the query string parameter to get the value for.
		* @returns {string} Value of the query string parameter.
	*/
	rmvpp.getQueryString = function(name) {
		name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
		var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
			results = regex.exec(location.search);
		return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
	}

	/**
		* Get number of query string parameters in the URL starting with a given string.
		* @param {string} search Search string to check parameters for.
		* @returns {number} Number of query string parameters starting with the search parameter.
	*/
	rmvpp.getNumQueryString = function(search) {
		var query = window.location.search.substring(1);
		var vars = query.split('&').map(function(v) {
			return v.split('=');
		});
		var out = vars.filter(function(v) {
			return v[0].indexOf(search) == 0;
		});
		return (out.length);
	}

    // Converts an object of arrays into an array matrix, filling in gaps for inconsistent sizes
    rmvpp.objectToMatrix = function(obj, nullVal) {
        nullVal = nullVal || 0;
        var array = [], lengths = [];
        for (var key in obj) {
            array.push(obj[key].slice(0));
            lengths.push(obj[key].length);
        }

        var max = d3.max(lengths); // Max length
        array.forEach(function(arr) {
            var arrLength = arr.length;
            for (var i=0; i < max - arrLength; i++) {
                arr.push(nullVal);
            }
        });
        return array;
    }

    // Transpose 2D array
    rmvpp.transpose = function(array) {
        var newArray = array[0].map(function(col, i) {
            return array.map(function(row) {
                return row[i];
            })
        });
        return newArray;
    }


	/* ------ END OF GENERIC JAVASCRIPT FUNCTIONS ------ */

	// Universal label format
	var scienceFormat = d3.format('.3s');

    return rmvpp;

}(rmvpp || {}))

/* ------ D3 EXTENSIONS ------ */

var localeTemplate = { // GB
	decimal: ".",
	thousands: ",",
	grouping: [3],
	currency: ["£", ""],
	dateTime: "%a %e %b %X %Y",
	date: "%d/%m/%Y",
	time: "%H:%M:%S",
	periods: ["AM", "PM"],
	days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
	shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
	months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
	shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
}

// List of all possible locales, specified by D3 format
rmvpp.locales = {
	GB : d3.locale(localeTemplate),
	EU : d3.locale($.extend(localeTemplate, {
		currency: ["€", ""]
	})),
	US : d3.locale($.extend(localeTemplate, {
		currency: ["$", ""],
		date: "%m/%d/%Y"
	}))
};

// Multi-time format for dynamic date scales
rmvpp.multiTimeFormat = d3.time.format.multi([
	[".%L", function(d) { return d.getMilliseconds(); }],
	[":%S", function(d) { return d.getSeconds(); }],
	["%I:%M", function(d) { return d.getMinutes(); }],
	["%I %p", function(d) { return d.getHours(); }],
	["%a %d", function(d) { return d.getDay() && d.getDate() != 1; }],
	["%b %d", function(d) { return d.getDate() != 1; }],
	["%Y %b", function(d) { return d.getMonth(); }],
	["%Y", function() { return true; }]
]);

// Get first element
d3.selection.prototype.first = function() {
  return d3.select(this[0][0]);
};

// Get last element
d3.selection.prototype.last = function() {
  var last = this.size() - 1;
  return d3.select(this[0][last]);
};

// Get parent element
d3.selection.prototype.parent = function() {
    return d3.selectAll($(this[0]).parent().toArray())
};

d3.selection.prototype.toJQuery = function() {
	return $(this[0]);
}

// Returns unique values from a given array
d3.unique = function(arr) {
    return d3.set(arr).values();
}

/* ------ END OF D3 EXTENSIONS ------ */

/* ------ JQUERY EXTENSIONS ------ */

// Wrap in extension function
jQuery.fn.extend({
	check: function() { // Check checkbox inputs
		return this.each(function() { this.checked = true; });
	},
	uncheck: function() { // Uncheck checkbox inputs
		return this.each(function() { this.checked = false; });
	},
	removeAncestor: function(depth) { // Remove ancestor elements (1 for parent, 2 for grandparent etc.)
		var elem = $(this)
		for (var i=0; i < depth; i++) {
			elem = elem.parent();
		}
		return this.each((function() { elem.remove(); }));
	},
	hasVertScrollBar: function() {
		return this.get(0) ? this.get(0).scrollHeight > this.innerHeight() : false;
	},
	hasHorizScrollBar: function() {
		return this.get(0) ? this.get(0).scrollWidth > this.innerWidth() : false;
	},
	toD3: function() {
		return d3.selectAll(this.toArray());
	}
});

// Remove element from array
jQuery.removeFromArray = function(element, array) {
    var pos = $.inArray(element, array);
	if (pos > -1)
		array.splice(pos, 1);
    return pos;
};

// Move elements from one position to another
jQuery.moveInArray = function(array, old_index, new_index) {
    if (new_index >= array.length) {
        var k = new_index - array.length;
        while ((k--) + 1) {
            array.push(undefined);
        }
    }
    array.splice(new_index, 0, array.splice(old_index, 1)[0]);
    return array;
};

// Get directory of a path string
jQuery.dirFromPath = function(path, stripTrail) {
	var re = RegExp('([^\\\\]*\/).*'); // Get path without filename
    var out = re.exec(path)[1];
    if (stripTrail)
        out = out.substr(0, out.length-1);
	return out;
}

// Get filename of a paht string
jQuery.fileFromPath = function(path) {
	var re = RegExp('[^\\\\]*\/(.*)'); // Get path without filename
	return re.exec(path)[1]
}

// Get cookie by name
jQuery.getCookie = function(name) {
	var value = "; " + document.cookie;
	var parts = value.split("; " + name + "=");
	if (parts.length == 2) return parts.pop().split(";").shift();
}

// Returns the browser type, in lowercase
jQuery.checkBrowser = function() {
	if (/*@cc_on!@*/false || !!document.documentMode) return 'ie'; // Internet Explorer 6-11
	if (!!window.StyleMedia) return 'edge' // Edge 20+
	if (!!window.chrome && !!window.chrome.webstore) return 'chrome'; // Chrome 1+
	if ((!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0) return 'opera'; // Opera 8.0+
	if (typeof InstallTrigger !== 'undefined') return 'firefox' // Firefox 1.0+
	if (Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0); // Safari 3+
}

// Gets the text currently selected by the user
jQuery.getSelectedText = function() {
    var text = "";
    if (window.getSelection) {
        text = window.getSelection().toString();
    } else if (document.selection && document.selection.type != "Control") {
        text = document.selection.createRange().text;
    }
    return text;
}

/* ------ END OF JQUERY EXTENSIONS ------- */

/* ------ FABRIC EXTENSIONS ------ */

// Check if object is a canvas with objects
if (typeof(fabric) != 'undefined') {
	fabric.checkCanvasJSON = function (json) {
		out = false;
		if (json) {
			if (json.objects) {
				if (json.objects.length > 0) {
					out = true;
				}
			}
		}
		return out;
	}
}

/* ------ END OF FABRIC EXTENSIONS ------ */

/* ------ LEAFLET EXTENSIONS ------ */

if (typeof L !== 'undefined') {
	// Tile Layer helper extension for free tile layer maps
	L.TileLayer.Common = L.TileLayer.extend({
		initialize: function (options) {
			L.TileLayer.prototype.initialize.call(this, this.url, options);
		}
	});

	// Map to be used across plugins. Change tile set as desired, options below are all open source
	(function () {
		// Open Street Map
		L.TileLayer.Main = L.TileLayer.Common.extend({
			url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
			options: {attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'},
			crossOriginKeyword: null
		});

		// Map Quest
		// var mqTilesAttr = 'Tiles &copy; <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png" />';
		// L.TileLayer.MQ = L.TileLayer.Common.extend({
			// url: 'http://otile{s}.mqcdn.com/tiles/1.0.0/{type}/{z}/{x}/{y}.png',
			// options: {
				// subdomains: '1234',
				// type: 'osm',
				// attribution: 'Map data ' + L.TileLayer.OSM_ATTR + ', ' + mqTilesAttr
			// }
		// });

		// Map Quest Aerial
		// var mqTilesAttr = 'Tiles &copy; <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png" />';
		// L.TileLayer.MapQuestOpen = L.TileLayer.Common.extend({
			// url: 'http://otile{s}.mqcdn.com/tiles/1.0.0/{type}/{z}/{x}/{y}.png',
			// options: {
				// subdomains: '1234',
				// type: 'osm',
				// attribution: 'Map data ' + L.TileLayer.OSM_ATTR + ', ' + mqTilesAttr
			// }
		// });

		// L.TileLayer.Main = L.TileLayer.MapQuestOpen.extend({
			// options: {
				// type: 'sat',
				// attribution: 'Imagery &copy; NASA/JPL-Caltech and U.S. Depart. of Agriculture, Farm Service Agency, ' + mqTilesAttr
			// }
		// });

	}());

	// Extension to handle topojson
	L.TopoJSON = L.GeoJSON.extend({
		addData: function(jsonData) {
			if (jsonData.type === "Topology") {
				for (key in jsonData.objects) {
					geojson = topojson.feature(jsonData, jsonData.objects[key]);
					L.GeoJSON.prototype.addData.call(this, geojson);
				}
			}
			else {
				L.GeoJSON.prototype.addData.call(this, jsonData);
			}
		}
	});
}

/* ------ END OF LEAFLET EXTENSIONS ------ */

/* ------ JAVASCRIPT EXTENSIONS ------ */

String.prototype.toProperCase = function (plural) {
	var string = this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
	if (plural) {
		if (string[string.length-1] != 's')
			string += 's';
	}
    return string;
};

// Add a variable number of days to a JS date object
Date.prototype.addDays = function(days) {
   var dat = new Date(this.valueOf())
   dat.setDate(dat.getDate() + days);
   return dat;
}

/* ------ END OF JAVASCRIPT EXTENSIONS ------ */
