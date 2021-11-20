"use strict";
const luaparse = require( "luaparse" );
const { DOMParser, XMLSerializer } = require( "xmldom" );
const fs = require( "fs" );
const path = require( "path" );
const args = process.argv.slice( 2 );

const VERSION = process.env.npm_package_version;
const DEFAULT_XML = "default.xml";

const ALL_IDENT_CHARS = [
	"0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
	"a", "b", "c", "d", "e", "f", "g", "h", "i", "j",
	"k", "l", "m", "n", "o", "p", "q", "r", "s", "t",
	"u", "v", "w", "x", "y", "z", "A", "B", "C", "D",
	"E", "F", "G", "H", "I", "J", "K", "L", "M", "N",
	"O", "P", "Q", "R", "S", "T", "U", "V", "W", "X",
	"Y", "Z", "_"
];
const NUM_ALL_IDENT_CHARS = ALL_IDENT_CHARS.length;
const DEFAULT_INDEX = 10;

const minimizer = {
	currentIndex: DEFAULT_INDEX,
	identMap: {},

	generate( name )
	{
		if( this.identMap[name] )
		{
			return this.identMap[name];
		}

		var newname = "";

		do
		{
			var index = this.currentIndex;
			if( index > NUM_ALL_IDENT_CHARS )
			{
				var num = Math.trunc( index / NUM_ALL_IDENT_CHARS ) + DEFAULT_INDEX;
				index = index % NUM_ALL_IDENT_CHARS;
				newname = ALL_IDENT_CHARS[num] + ALL_IDENT_CHARS[index];
			}
			else
			{
				newname = ALL_IDENT_CHARS[index];
			}
			this.currentIndex++;
		}
		while(
			newname === "and"   || newname === "break"  || newname === "do"     || newname === "else"     || newname === "elseif" ||
			newname === "end"   || newname === "false"  || newname === "for"    || newname === "function" || newname === "if"     ||
			newname === "in"    || newname === "local"  || newname === "nil"    || newname === "not"      || newname === "null"   ||
			newname === "or"    || newname === "repeat" || newname === "return" || newname === "then"     || newname === "true"   ||
			newname === "until" || newname === "while"
		)

		return this.identMap[name] = newname;
	},
};

const fmt = {
	text: "",

	joinString( str = "" )
	{
		const separate = " ";
		const regex = /\w/;
		const first = this.text.slice( -1 ).match( regex );
		const last = str.slice( 0, 1 ).match( regex );

		if( first && last )
		{
			this.text += separate;
		}
		this.text += str;
	},

	joinVariables( arr = [] )
	{
		const separate = ",";
		for( var i = 0; i < arr.length; i++ )
		{
			this.text = this.find( arr[i] );
			if( arr[i+1] )
			{
				this.text += separate;
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

{
	const origPath = path.join( args[0], DEFAULT_XML );
	const copyPath = origPath + ".old";
	fs.copyFileSync( origPath, copyPath, fs.constants.COPYFILE_FICLONE );

	const xmlSource = fs.readFileSync( origPath, { encoding: "utf8" } );

	const parser = new DOMParser();
	const doc = parser.parseFromString( xmlSource, "application/xml" );
	const element = doc?.documentElement;

	if( element !== null )
	{
		const luaSource = "(function(__this)\n"
						+ fs.readFileSync( "source.lua", { encoding: "utf8" } )
						+ "\nend)()";
		const options = {
			comments: false,
			scope: true,
		};
		const ast = luaparse.parse( luaSource, options );
		const newLuaSource = "%" + fmt.find( ast ).slice( 1, -3 );

		element?.setAttribute( "InitCommand", newLuaSource );

		const XML = new XMLSerializer();
		fs.writeFileSync( origPath, XML.serializeToString(doc) );
	}
}
