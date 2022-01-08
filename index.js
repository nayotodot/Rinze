"use strict";
const luaparse = require( "luaparse" );
const { DOMParser, XMLSerializer } = require( "xmldom" );
const fs = require( "fs" );
const path = require( "path" );
const args = process.argv.slice( 2 );

const NPM_PACKAGE_NAME = process.env.npm_package_name;
const NPM_PACKAGE_VERSION = process.env.npm_package_version;
const DEFAULT_XML = "default.xml";

const IDENT_CHARS = [
	"0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
	"a", "b", "c", "d", "e", "f", "g", "h", "i", "j",
	"k", "l", "m", "n", "o", "p", "q", "r", "s", "t",
	"u", "v", "w", "x", "y", "z", "A", "B", "C", "D",
	"E", "F", "G", "H", "I", "J", "K", "L", "M", "N",
	"O", "P", "Q", "R", "S", "T", "U", "V", "W", "X",
	"Y", "Z", "_"
];
const NUM_IDENT_CHARS = IDENT_CHARS.length;
const DEFAULT_INDEX = 10;

function logarithm( x, y )
{
	return Math.log( y ) / Math.log( x );
}

function isDefinition( name )
{
	return (
		name === "and"   || name === "break"  || name === "do"     || name === "else"     || name === "elseif" ||
		name === "end"   || name === "false"  || name === "for"    || name === "function" || name === "if"     ||
		name === "in"    || name === "local"  || name === "nil"    || name === "not"      || name === "null"   ||
		name === "or"    || name === "repeat" || name === "return" || name === "then"     || name === "true"   ||
		name === "until" || name === "while"
	);
}

const minimizer = {
	currentIndex: DEFAULT_INDEX,
	identMap: {},

	generate( name )
	{
		if( this.identMap[name] )
		{
			return this.identMap[name];
		}

		while( this.currentIndex < Infinity )
		{
			var newname = "";
			var currentIndex = this.currentIndex;
			var length = Math.trunc( logarithm( NUM_IDENT_CHARS, currentIndex ) );

			for( var i = length; i >= 0; i-- )
			{
				const index = Math.trunc( currentIndex / (NUM_IDENT_CHARS ** i) ) % NUM_IDENT_CHARS;
				newname += IDENT_CHARS[index];
			}

			this.currentIndex++;

			if( isNaN(newname.slice(0,1)) && !isDefinition(newname) )
			{
				return this.identMap[name] = newname;
			}
		}
	},
};

const fmt = {
	text: "",

	joinString( str = "" )
	{
		const regex = /\w/;
		const first = regex.test( this.text.slice(-1) );
		const last = regex.test( str.slice(0,1) );

		if( first && last )
		{
			this.text += " ";
		}
		this.text += str;
	},

	joinVariables( arr = [] )
	{
		for( var i = 0; i < arr.length; i++ )
		{
			this.text = this.find( arr[i] );
			if( arr[i+1] )
			{
				this.text += ",";
			}
		}
	},

	join( obj )
	{
		switch( typeof obj )
		{
			case "string":
				this.joinString( obj );
				break;
			case "object":
				this.joinVariables( obj );
				break;
		}

		return this.text;
	},

	each( arr )
	{
		for( var i = 0; i < arr.length; i++ )
		{
			this.find( arr[i] );
		}

		return this.text;
	},

	base( obj = {} )
	{
		const sType = obj?.type;
		const isParen = (
			sType === "FunctionDeclaration" ||
			sType === "StringLiteral" ||
			sType === "TableConstructorExpression" ||
			sType === "LogicalExpression" ||
			sType === "BinaryExpression" ||
			sType === "CallExpression"
		);

		if( isParen )
		{
			this.join( "(" );
		}

		this.find( obj );

		if( isParen )
		{
			this.join( ")" );
		}

		return this.text;
	},

	find( obj = {} = {} )
	{
		const sType = obj?.type;

		switch( sType )
		{
			case "LabelStatement":
				{
					/* AST issued. */
					/*
					this.join( "::" );
					this.join( obj.label );
					this.join( "::" );
					*/
				}
				break;
			case "BreakStatement":
				{
					this.join( "break" );
				}
				break;
			case "GotoStatement":
				{
					/* AST issued. */
					/*
					this.join( "goto" );
					this.join( obj.label );
					*/
				}
				break;
			case "ReturnStatement":
				{
					this.join( "return" );
					this.join( obj.arguments );
				}
				break;
			case "IfStatement":
				{
					this.each( obj.clauses );
					this.join( "end" );
				}
				break;
			case "IfClause":
				{
					this.join( "if" );
					this.find( obj.condition );
					this.join( "then" );
					this.each( obj.body );
				}
				break;
			case "ElseifClause":
				{
					this.join( "elseif" );
					this.find( obj.condition );
					this.join( "then" );
					this.each( obj.body );
				}
				break;
			case "ElseClause":
				{
					this.join( "else" );
					this.each( obj.body );
				}
				break;
			case "WhileStatement":
				{
					this.join( "while" );
					this.find( obj.condition );
					this.join( "do" );
					this.each( obj.body );
					this.join( "end" );
				}
				break;
			case "DoStatement":
				{
					this.join( "do" );
					this.each( obj.body );
					this.join( "end" );
				}
				break;
			case "RepeatStatement":
				{
					this.join( "repeat" );
					this.each( obj.body );
					this.join( "until" );
					this.find( obj.condition );
				}
				break;
			case "LocalStatement":
				{
					this.join( "local" );
					this.join( obj.variables );
					if( obj.init.length )
					{
						this.join( "=" );
						this.join( obj.init );
					}
				}
				break;
			case "AssignmentStatement":
				{
					this.join( obj.variables );
					this.join( "=" );
					this.join( obj.init );
				}
				break;
			case "CallStatement":
				{
					this.find( obj.expression );
				}
				break;
			case "FunctionDeclaration":
				{
					if( obj.isLocal )
					{
						this.join( "local" );
					}
					this.join( "function" );
					if( obj.identifier )
					{
						this.find( obj.identifier );
					}
					this.join( "(" );
					this.join( obj.parameters );
					this.join( ")" );
					this.each( obj.body );
					this.join( "end" );
				}
				break;
			case "ForNumericStatement":
			case "ForGenericStatement":
				{
					this.join( "for" );
					if( sType === "ForNumericStatement" )
					{
						this.find( obj.variable );
						this.join( "=" );
						this.find( obj.start );
						this.join( "," );
						this.find( obj.end );
						if( obj.step )
						{
							this.join( "," );
							this.find( obj.step );
						}
					}
					else if( sType === "ForGenericStatement" )
					{
						this.join( obj.variables );
						this.join( "in" );
						this.join( obj.iterators );
					}
					this.join( "do" );
					this.each( obj.body );
					this.join( "end" );
				}
				break;
			case "Chunk":
				{
					this.each( obj.body );
				}
				break;
			case "Identifier":
				{
					if( obj.isLocal )
					{
						obj.name = minimizer.generate( obj.name );
					}
					this.join( obj.name );
				}
				break;
			case "StringLiteral":
			case "NumericLiteral":
			case "BooleanLiteral":
			case "NilLiteral":
			case "VarargLiteral":
				{
					this.join( obj.raw );
				}
				break;
			case "TableKey":
				{
					this.join( "[" );
					this.find( obj.key );
					this.join( "]" );
					this.join( "=" );
					this.find( obj.value );
				}
				break;
			case "TableKeyString":
				{
					this.find( obj.key );
					this.join( "=" );
					this.find( obj.value );
				}
				break;
			case "TableValue":
				{
					this.find( obj.value );
				}
				break;
			case "TableConstructorExpression":
				{
					this.join( "{" );
					this.join( obj.fields );
					this.join( "}" );
				}
				break;
			case "LogicalExpression":
			case "BinaryExpression":
				{
					this.find( obj.left );
					this.join( obj.operator );
					this.find( obj.right );
				}
				break;
			case "UnaryExpression":
				{
					this.join( obj.operator );
					this.find( obj.argument );
				}
				break;
			case "MemberExpression":
				{
					this.base( obj.base );
					this.join( obj.indexer );
					this.find( obj.identifier );
				}
				break;
			case "IndexExpression":
				{
					this.base( obj.base );
					this.join( "[" );
					this.find( obj.index );
					this.join( "]" );
				}
				break;
			case "CallExpression":
				{
					this.base( obj.base );
					this.join( "(" );
					this.join( obj.arguments );
					this.join( ")" );
				}
				break;
			case "TableCallExpression":
				{
					this.find( obj.base );
					this.join( obj.arguments );
				}
				break;
			case "StringCallExpression":
				{
					this.find( obj.base );
					this.find( obj.argument );
				}
				break;
			case "Comment":
				break;
		}

		return this.text;
	},
};

const fsOptions = { encoding: "utf8" };
const luaparseOptions = {
	comments: false,
	scope: true,
};

{
	const origPath = path.join( args[0], DEFAULT_XML );
	const copyPath = origPath + ".old";

	let xmlSource;
	if( fs.existsSync(origPath) )
	{
		fs.copyFileSync( origPath, copyPath, fs.constants.COPYFILE_FICLONE );

		xmlSource = fs.readFileSync( origPath, fsOptions );
		if( !xmlSource )
		{
			throw "XML load error"
		}
	}
	else
	{
		xmlSource = "<ActorFrame><children>\n\n</children></ActorFrame>";
	}

	const parser = new DOMParser();
	var doc = parser.parseFromString( xmlSource, "application/xml" );
	var element = doc?.documentElement;

	if( !element )
	{
		throw "XML parse error"
	}

	var luaSource = `(function(__this)
					${fs.readFileSync( "source.lua", fsOptions )}
					end)()`;
	luaSource = luaSource?.replace( "__NAME__", "\"" + NPM_PACKAGE_NAME + "\"" );
	luaSource = luaSource?.replace( "__VERSION__", "\"" + NPM_PACKAGE_VERSION + "\"" );

	var ast = luaparse.parse( luaSource, luaparseOptions );
	var newLuaSource = "%" + fmt.find( ast ).slice( 1, -3 );

	element?.setAttribute( "InitCommand", newLuaSource );

	const XML = new XMLSerializer();
	fs.writeFileSync( origPath, XML.serializeToString(doc) );
}
