//=============================================================================
//
// Trailer - The Ultimate Railroad Diagram Generator
//
// File:		trailer.js
// Description:	Javascript code for the diagram generator and EBNF parser
// Author:		Guido Hoss
// Version:		1.0.0
// Date:		18-May-2016
//
//=============================================================================
// Copyright (C) 2016 by Guido Hoss
//
// Trailer is free software: you can redistribute it and/or 
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation, either version 3
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public
// License along with this program.  If not, see
// <http://www.gnu.org/licenses/>.
//
// Git repository home: <https://github.com/ghoss/Trailer>
//=============================================================================

//-----------------------------------------------------------------------------
// CLASS DEFINITION
//
// RR_Diagram
//
// Methods to generate a railroad diagram in HTML based on a parse tree 
//
// callback :	Function to be called for each rule of a defined grammar
//				Arguments:	
//					.target		= HTML code of syntax tree
//					.symbol		= Parsed symbol identifier for current rule
//					.rule		= Parsed rule definition
//					.body		= Generated syntax diagram for rule
//-----------------------------------------------------------------------------

function RR_Diagram(callback) {

	// Register callback function
	this.callback = callback ? callback : this.dummy_callback;
	
	// CSS class names of the core diagram elements
	this.css = {
		term : "rr_terminal",
		nterm : "rr_nonterminal",
		sterm : "rr_specterminal",
		line : "rr_line",
		wrap : "rr_wrapper",
		vspace : 10		// Vertical spacing between stacked elements
	};
	
	// HTML entities to be used for diagram box model
	this.class = {
		box : "<div>",
		line : "<div>",
		wrap : "<div>"
	}
	
	// Parameter for vbranch routine specifies side on which branch is to be drawn
	this.side = {
		left : 1,
		right : -1
	}
}


//-----------------------------------------------------------------------------
// RR_Diagram :: dummy_callback
//
// Provides a dummy callback routine in case the user did not specify one of
// his own.
//-----------------------------------------------------------------------------

RR_Diagram.prototype.dummy_callback = function(data) {
	// Create header and footer
	var header = $("<h2>");
	header.html(data.symbol);	
	var footer = $("<p>");
	footer.html(data.rule);

	// Append everything to target location
	$(data.target, data.targetDoc).append(header, data.diagram, footer);
}


//-----------------------------------------------------------------------------
// RR_Diagram :: vbranch
//
// Draw vertical branches on left and right side for a node with stacked 
// elements (i.e. a choice node or a loop node)
//
// node	:		node to be processed
// clsUpper : 	CSS class of upper branch segment
// clsLower : 	CSS class of lower branch segment
// xPos	:		Horizontal position of branch connectors
// side : 		(this.side.left | this.side.right)
// loop : 		true for a loop node, false for a choice node
//
// RETURNS :	New node which contains "node" and the vertical branches 
//-----------------------------------------------------------------------------

RR_Diagram.prototype.vbranch = function(node, clsUpper, clsLower, xPos, side, loop) {
	var div = this.class.wrap
	var cssline = this.css.line
	
	var dom = $(div);
	var maxW = node.outerWidth();
	var lineY = node.data("lineY");

	// Create short branches for stacked elements
	var lastY = 0;
	var firstElem = true;
	
	// Iterate through each element of node
	node.children().each( function() {
	
		var lineY = $(this).data("lineY");
		var yPos = $(this).position().top;
		var thisX = 20;
		var thisW = maxW - 40;
		
		// Save lowest connector position for later
		lastY = yPos;
		
		if (firstElem) {
			// Top element: make line segment longer to compensate for missing curve
			thisW = maxW - 20;
			thisX = 10;
			firstElem = false;
		}
		else {
			// Draw a curved connector stub
			vl = $("<div>", {class: clsLower});
			dom.append(vl);
			vl.css({
				"height" : 10, 
				"top" : yPos + lineY - 10,
				"left" : xPos + side * 10
			});
		}
		
		// If this is a right branch, make horizontal connector to current element
		if ((side == -1)) {
			var hl = $(div, {"class" : cssline});
			hl.css({
				"top" : yPos + lineY,
				"left" : thisX,
				"width" : thisW
			});
			dom.append(hl);
		}
	});
	
	// Create vertical branch line from base to node
	var vl = $(this.class.wrap, {class: clsUpper});
	dom.append(vl);
	vl.css({
		"height" : lastY - 10,
		"width" : 10,
		"top" : lineY,
		"left" : xPos
	});
	
	// Add an UP arrow on the left/right side, depending on loop or choice
	if (loop && (side == 1)) {
		// Arrow on left side for loops
		vl.html("&#9650;");
		vl.css("text-indent", "5px");
	}
	else if ((! loop) && (side == -1)) {
		// Arrow on right side for choices
		vl.html("&#9650;");
	}
	
	return dom;
}


//-----------------------------------------------------------------------------
// RR_Diagram :: setroot
//
// Create new DOM root for child instances
//
// RETURNS :	.saved = previous root
//				.node = new current root
//-----------------------------------------------------------------------------

RR_Diagram.prototype.setroot = function() {
	var saved = this.root;
	var node = this.wrap();
	this.root.append(node);
	this.root = node;
	
	return { "saved" : saved, "node" : node };
}


//-----------------------------------------------------------------------------
// RR_Diagram :: line
//
// Return a new line instance
//
// RETURNS :	New DOM instance containing a line
//-----------------------------------------------------------------------------

RR_Diagram.prototype.line = function() {
	var inst = $(this.class.line, {class: this.css.line});
	return inst;
}


//-----------------------------------------------------------------------------
// RR_Diagram :: wrapper
//
// Return a new wrapper instance
//
// RETURNS :	New DOM instance for empty wrapper
//-----------------------------------------------------------------------------

RR_Diagram.prototype.wrap = function() {
	var inst = $(this.class.wrap, {class: this.css.wrap});
	return inst;
}


//-----------------------------------------------------------------------------
// RR_Diagram :: opt_or_loop
//
// Draw a choice or a loop
//
// grammar :	Parse tree for subcomponents of choice/loop
// loop :		true = is a loop
//				false = is a choice
//
// RETURNS :	New DOM instance containing stacked subcomponents
//-----------------------------------------------------------------------------

RR_Diagram.prototype.opt_or_loop = function(grammar, loop) {
	var thisroot = this.setroot();
	var node = thisroot.node;
	var vspace = this.css.vspace;

	// Execute grammar
	grammar();
	
	// Throw error if we only have one choice (this would be a sequence instead)
	if (node.children().length <= 1) {
		throw "d_opt: only one element specified";
	}
	
	// Get vertical offset of base of branch line
	var lineY = node.children().first().data("lineY");

	// Arrange elements in vertical stack
	var maxW = 0;
	var y = 0;
	node.children().each( function() {
		var thisH = $(this).outerHeight();
		
		$(this).css({
			"top" : y, 
			"left" : 20
		});
	
		y += thisH + vspace;
		maxW = Math.max(maxW, $(this).outerWidth());
	});
				
	// Fix CSS dimensions of wrapper
	node.css({
		"width" : maxW + 40,	// add 20px on each side for vertical branches
		"height" : y - vspace
	});
	node.data("lineY", lineY);
	
	// Traverse tree again to center elements horizontally
	node.children().each( function() {
		var thisW = $(this).outerWidth();
		
		$(this).css("left", (maxW + 40 - thisW) >> 1);
	});
	
	// Traverse tree once for left vertical branch
	var bLeft = this.vbranch(
		node, "rr_line_volu", "rr_line_voll", 0, this.side.left, loop
	);
	
	// Traverse tree again for right branch, using x from first pass for horiz. position
	var bRight = this.vbranch(
		node, "rr_line_voru", "rr_line_vorl", maxW + 30, this.side.right, loop
	);
		
	node.append(bLeft);
	node.append(bRight);
	this.root = thisroot.saved;
}


//-----------------------------------------------------------------------------
// RR_Diagram :: d_opt
//
// Draw a choice
//
// grammar :	Parse tree for subcomponents of choice
//
// RETURNS :	New DOM instance containing subcomponents and vertical branches
//-----------------------------------------------------------------------------

RR_Diagram.prototype.d_opt = function(grammar) {
	this.opt_or_loop(grammar, false);
}


//-----------------------------------------------------------------------------
// RR_Diagram :: d_loop
//
// Draw a loop
//
// grammar :	Parse tree for subcomponents of loop
//
// RETURNS :	New DOM instance containing subcomponents and vertical branches
//-----------------------------------------------------------------------------

RR_Diagram.prototype.d_loop = function(grammar) {
	this.opt_or_loop(grammar, true);
}


//-----------------------------------------------------------------------------
// RR_Diagram :: d_box
//
// Draw a text box with horizontal connectors
//
// text :		Text contents of box
// cls :		CSS class of box
//
// RETURNS :	New DOM instance containing box and connector line
//-----------------------------------------------------------------------------

RR_Diagram.prototype.d_box = function(text, cls) {
	var node = this.wrap();
	this.root.append(node);
	
	// Draw left line segment, box, right line segment
	var line = this.line();
	var box = $(this.class.box, {class: cls})
	box.html(text);
	node.append(line, box);
	
	var w_box = box.outerWidth();
	var h_box = box.outerHeight();
	var w_node = w_box + 20;
	
	// Adjust positions
	line.css({
		"top" : h_box >> 1,
		"width" : w_node
	});
	box.css({
		"left" : 10
	});
	
	// Store vertical line offset
	node.data("lineY", h_box >> 1);
	
	// Fix CSS dimensions of wrapper
	node.css({
		"width" : w_node,
		"height" : h_box
	});
}


//-----------------------------------------------------------------------------
// RR_Diagram :: d_empty
//
// Draw an empty node
//
// RETURNS :	New DOM instance of an empty node
//-----------------------------------------------------------------------------

RR_Diagram.prototype.d_empty = function() {
	var node = this.wrap();
	this.root.append(node);

	// Padding must be defined to avoid round-off errors
	node.css({
		"height" : 20,
		"padding" : 5
	});
	node.data("lineY", node.outerHeight() >> 1);
}


//-----------------------------------------------------------------------------
// RR_Diagram :: d_seq
//
// Draw a sequence
// 
// grammar :	Parse tree for subcomponents of sequence
//
// RETURNS :	New DOM instance with connected subcomponents
//-----------------------------------------------------------------------------

RR_Diagram.prototype.d_seq = function(grammar) {
	var thisroot = this.setroot();
	var node = thisroot.node;
	
	var x = 0;
	var y = 0;
	var lineY = 0;
	
	// Execute grammar
	grammar();
	
	// Traverse tree to adjust horizontal positions
	node.children().each( function() {
		$(this).css({"left" : x});
		x += $(this).outerWidth();
		y = Math.max(y, $(this).outerHeight());
		lineY = Math.max(lineY, $(this).data("lineY"));
	});
	
	// Traverse tree once more to adjust vertical positions
	node.children().each( function() {
		var thisY = $(this).data("lineY");
		if (thisY != lineY) {
			var delta = lineY - thisY;
			$(this).css("top", lineY - thisY);
			
			// If element has been shifted, total height will possibly change too
			y = Math.max(y, $(this).outerHeight() + delta);
		}
	});

	// Fix CSS dimensions of wrapper
	node.css({
		"width" : x,
		"height" : y
	});
	node.data("lineY", lineY);
	
	// Restore previous root node
	this.root = thisroot.saved;
}


//-----------------------------------------------------------------------------
// RR_Diagram :: compose
//
// Compose an entire railroad diagram
//
// target :		CSS selector for parent entity of diagram
// targetDoc :	DOM object of target document
// grammar :	Parse tree for diagram 
// s_header :	Title of this diagram
// s_descr :	Description of this diagram
//-----------------------------------------------------------------------------

RR_Diagram.prototype.compose = function(target, targetDoc, grammar, s_header, s_footer) {

	// Create new wrapper for diagram
	var body = $("<div>");

	// Call user routine with diagram data
	this.callback({
		"target" : target,
		"targetDoc" : targetDoc,
		"symbol" : s_header,
		"rule" : s_footer,
		"diagram" : body
	});
	
	// Execute grammar
	this.root = body;
	grammar();
	
	// Fix body dimensions
	body.css({
		"height" : body.children().first().outerHeight(),
		"width" : body.children().first().outerWidth()
	});
}


//-----------------------------------------------------------------------------
// CLASS DEFINITION
//
// EBNF
//
// Methods to convert an EBNF grammar specification into a parse tree
//
// callback :	Function to be called for each rule of a defined grammar
//				Arguments:	
//					.target		= HTML code of syntax tree
//					.symbol		= Parsed symbol identifier for current rule
//					.rule		= Parsed rule definition
//					.body		= Generated syntax diagram for rule
//-----------------------------------------------------------------------------

function EBNF(callback) {
	this.rr = new RR_Diagram(callback);
}


//-----------------------------------------------------------------------------
// EBNF :: trim
//
// Removes leading and trailing whitespace, including tabs and newlines,
// from a string.
//
// str :		String
//
// RETURNS :	Trimmed string
//-----------------------------------------------------------------------------

EBNF.prototype.trim = function(str) {
	return $.trim(str.replace(/[\t\n\r]+/g, ""));
};


//-----------------------------------------------------------------------------
// EBNF :: p_ident
//
// Parse an identifier
//
// grammar :	Grammar specification
//
// RETURNS :	.ident = matched identifier
//				.trailer = remaining grammar
//-----------------------------------------------------------------------------

EBNF.prototype.p_ident = function(grammar) {
	var match;
	
	if (match = /^([A-Za-z0-9][A-Za-z0-9_]*)(.*)$/.exec(grammar)) {
		return { 
			"ident" : match[1],
			"trailer" : match[2]
		};
	}
	else {
		return null;
	}
}


//-----------------------------------------------------------------------------
// EBNF :: p_string
//
// Parse a string
//
// grammar :	Grammar specification
//
// RETURNS :	.string = matched string
//				.quote = matched quote character
//				.trailer = remaining grammar
//-----------------------------------------------------------------------------

EBNF.prototype.p_string = function(grammar) {
	if ((match = /^([\"])([^\"]+)\"(.*)$/.exec(grammar)) ||
		(match = /^(\')([^\']+)\'(.*)$/.exec(grammar)) ||
		(match = /^(\?)([^\?]+)\?(.*)$/.exec(grammar))) {
		
		return { 
			"quote" : match[1],
			"string" : match[2],
			"trailer" : match[3]
		};
	}
	else {
		return null;
	}
}


//-----------------------------------------------------------------------------
// EBNF :: p_rule
//
// Parse a rule
//		term = enclosed | identifier | string | "_"
//		rule = term, (( "|" | "," ),term )*
//		enclosed = 
//			( "(" , rule, ")" ) |
//			( "(", rule, ")+" ) |
//			( "(", rule, ")*" ) |
//			( "(", rule, ")?" )
//
// grammar	:	Grammar specification
//
// RETURNS	:	.trailer = Remaining grammar trailer
//				.tree = Parse tree
//-----------------------------------------------------------------------------

EBNF.prototype.p_rule = function(grammar) {

	grammar = this.trim(grammar);
	var res, thisRes;
	var resArray = [];
	var inSequence = true;
	var thisChar = "";
	var seqChar = "";
	
	do {
		if (res = this.p_string(grammar)) {
			// String
			var css = (res.quote == "?") ? "sterm" : "term";
			resArray.push(thisRes = { 
				"tree" : "rr.d_box(\"" + res.string + "\", rr.css." + css + ")",
				"rule" : '"' + res.string + '"',
				"trailer" : res.trailer
			});
		}
		else if (res = this.p_ident(grammar)) {
			// Identifier
			resArray.push(thisRes = {
				"tree" : "rr.d_box(\"" + res.ident + "\", rr.css.nterm)",
				"rule" : res.ident,
				"trailer" : res.trailer
			});
		}
		else if (grammar.substr(0, 1) == "_") {
			// Null expression
			resArray.push(thisRes = {
				"tree" : "rr.d_empty()",
				"rule" : "_",
				"trailer" : grammar.slice(1)
			});
		}
		else if (grammar.substr(0, 1) == "(") {
			// Enclosed rule
			res = this.p_rule(grammar.slice(1));
			grammar = this.trim(res.trailer);
		
			if (grammar.substr(0, 1) == ")") {
				// Rule in grouping parentheses
				grammar = this.trim(grammar.slice(1));
				var g0 = "(";
				var g1 = ")" + grammar.substr(0, 1);
				var skip = true;
				var tree = "";

				switch (g1) {
					case ')*' :
						// Zero or many repetitions of rule (i.e. rule on backward loop)
						tree = "rr.d_opt(function(){rr.d_empty();rr.d_loop(function(){" + res.tree + ";rr.d_empty()})})";
						break;
					
					case ')?' :
						// Zero or one repetitions of rule (i.e. rule with bypass)
						tree = "rr.d_opt(function(){" + res.tree + "; rr.d_empty()})";
						break;
				
					case ')+' :
						// One or more repetitions of rule (i.e. rule with backward loop)
						tree = "rr.d_loop(function(){" + res.tree + "; rr.d_empty()})";
						break;
					
					default :
						// Simple parentheses
						tree = res.tree;
						g1 = ")";
						skip = false;
						break;
				}
				resArray.push(thisRes = {
					"tree" : tree,
					"rule" : g0 + res.rule + g1,
					"trailer" : skip ? grammar.slice(1) : grammar
				});
			}
			else {
				throw "ENBF::p_rule: Invalid enclosed rule";
			}
		}
		else {
			throw "ENBF::p_rule : Syntax error";
		}
		
		// Lookahead for | or , operators
		grammar = this.trim(thisRes.trailer);
		switch (thisChar = grammar.substr(0, 1)) {
		
			case '|' :
			case ',' :
				if (seqChar == "") {
					// First operator in sequence, expect all following ones to be the same
					seqChar = thisChar;
					grammar = this.trim(grammar.slice(1));
				}
				else if (thisChar == seqChar) {
					// Second or following operator in sequence
					grammar = this.trim(grammar.slice(1));
				}
				else {
					// No operator of same kind detected
					inSequence = false;
				}
				break;
				
			default :
				// No operator found, exit loop
				inSequence = false;
				break;
		}
	} while (inSequence);
	
	// Combine individual terms of operator sequence
	if (resArray.length > 1) {
		var r = ""; 
		var s = "";
		
		for (var i = 0; i < resArray.length; i ++) {
			s += "," + resArray[i].tree;
			r += seqChar + resArray[i].rule;
		}
		s = s.slice(1);
		switch (seqChar) {
		
			case '|' :
				s = "rr.d_opt(function(){" + s + "})";
				break;
				
			case ',' :
				s = "rr.d_seq(function(){" + s + "})";
				break;
				
			default :
				throw "ENBF::p_rule : Unexpected error, sc=" + seqChar;
		}
		return {
			"tree" : s,
			"rule" : r.slice(1),
			"trailer" : grammar
		};
	}
	else if (resArray.length == 1) {
		// Result is the single element in the array
		return resArray[0];
	}
	else {
		throw "ENBF::p_rule : Unexpected error";
	}
}


//-----------------------------------------------------------------------------
// EBNF_Parser :: p_statement
// 
// Parse a statement
//		statement = symbol, "=", rule
//
// grammar	:	Grammar specification
//
// RETURNS	:	.trailer = Remaining grammar trailer
//				.tree = Parse tree
//				.symbol = Literal symbol matched
//				.rule = Literal rule matched
//-----------------------------------------------------------------------------

EBNF.prototype.p_statement = function(grammar) {

	// Parse left side
	var grammar = this.trim(grammar);
	var lhs = this.p_ident(grammar);
	if (! lhs) throw "EBNF::p_statement : left side identifier expected";
	
	// Parse right side
	var grammar = this.trim(lhs.trailer);
	if (grammar.substr(0, 1) == "=") {
		// Parse a rule
		var g1 = grammar.slice(1);
		var rhs = this.p_rule(g1);
		return { 
			"symbol" : lhs.ident,
			"rule" : rhs.rule,
			"tree" : rhs.tree,
			"trailer" : rhs.trailer
		};
	}
	else {
		throw "EBNF::p_statement : '=' expected";
	}	
}


//-----------------------------------------------------------------------------
// EBNF_Parser :: display
//
// Parse and displaya complete grammar specification where
//		grammar = ( statement, ";" )+
//
// grammar :	Grammar specification
// target :		CSS selector of target for diagram output
// targetDoc :	Target document (or "window.document" if undefined)
//-----------------------------------------------------------------------------

EBNF.prototype.display = function(grammar, target, targetDoc) {
	// Use current window if targetDoc undefined
	if (! targetDoc) targetDoc = window.document;
	
	grammar = this.trim(grammar);
	while (grammar != "") {
		// Parse a statement
		var res = this.p_statement(grammar);
		var rr = this.rr;

		// Generate diagram for this statement
		rr.compose(
			target, targetDoc, function () { eval(res.tree) },
			res.symbol, res.symbol + " = " + res.rule
		);
		
		// Expect trailing semicolon
		grammar = this.trim(res.trailer);
		if (grammar.substr(0, 1) == ";") {
			grammar = this.trim(grammar.slice(1));
		}
		else {
			throw "ENBF::parse : ';' expected";
		} 
	}
}
