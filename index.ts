import bodyParser from 'body-parser'
import express, { Request, Response } from 'express'

import { SnakeInfo, Move, GameRequest, GameState, Coordinates } from './types'

const PORT = process.env.PORT || 3000

const app = express()
app.use(bodyParser.json())

app.get('/', handleIndex)
app.post('/start', handleStart)
app.post('/move', handleMove)
app.post('/end', handleEnd)

app.listen(PORT, () => console.log(`TypeScript Battlesnake Server listening at http://127.0.0.1:${PORT}`))

enum Direction {
    up = 'up',
    left = 'left',
    down = 'down',
    right = 'right'
}

class Board {
    width: number;
    height: number;
    grid: string[][];

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.grid = [];
        for (let index = 0; index < height; index++) {
            this.grid.push([])
        }
        for (let row = 0; row < this.grid.length; row++) {
            for (let index = 0; index < width; index++) {
                this.grid[row].push('');
            }
        }
    }

    isValid(coords: Coordinates) {
        return coords.x >= 0 && coords.x < this.width 
        && coords.y >= 0 && coords.y < this.height 
        && (this.getData(coords) === '' || this.getData(coords) === 'food')
    }
    getData(coords: Coordinates) {
        return this.grid[this.height - 1 - coords.y][coords.x];
    }

    writeData(coords: Coordinates, data: string) {
        this.grid[this.height - 1 - coords.y][coords.x] = data;
    }
}

const directionToCoords = {
    [Direction.up]: { x: 0, y: 1 },
    [Direction.down]: { x: 0, y: -1 },
    [Direction.left]: { x: -1, y: 0 },
    [Direction.right]: { x: 1, y: 0 }
}

let lastDirection: Direction = Direction.up;

function constructBoard(data: GameState) {
    let board: Board = new Board(data.board.width, data.board.height);
    data.board.food.forEach(food => board.writeData(food, 'food'));
    data.board.snakes.forEach(snake => {
        snake.body.forEach(coord => board.writeData(coord, snake.id));
    });
    return board;
}

function distance(start: Coordinates, end: Coordinates) {
    return Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
}

function handleIndex(request: Request, response: Response<SnakeInfo>) {
    const battlesnakeInfo: SnakeInfo = {
        apiversion: '1',
        author: 'adisam',
        color: '#2bbfec',
        head: 'bendr',
        tail: 'small-rattle',
    }
    response.status(200).json(battlesnakeInfo)
}

function handleStart(request: GameRequest, response: Response) {
    const gameData = request.body

    console.log('START')
    response.status(200).send('ok')
}

function handleMove(request: GameRequest, response: Response<Move>) {
    const gameData: GameState = request.body
    const board = constructBoard(gameData);
    
    const position = gameData.you.head;
    const possibleMoves: Direction[] = [Direction.up, Direction.down, Direction.right, Direction.left]
    const validMoves: Set<Direction> = new Set(possibleMoves);
    const optimalMoves: Set<Direction> = new Set(possibleMoves);

    possibleMoves.forEach(direction => {
        const delta = directionToCoords[direction];
        const newCoords = { x: position.x + delta.x, y: position.y + delta.y };
        if (!board.isValid(newCoords)) {
            validMoves.delete(direction);
            optimalMoves.delete(direction);
        } else if (gameData.you.health < 25) {
            let dist = 500;
            let food: Coordinates = { x: -1, y: -1 };
            gameData.board.food.forEach(coord => {
                if (distance(position, coord) < dist) {
                    dist = distance(position, coord);
                    food = coord;
                }
            })
            if (distance(newCoords, food) > dist) {
                optimalMoves.delete(direction);
            }
        }
    })

    let move: Direction;
    if (optimalMoves.size > 0) {
        move = optimalMoves.values().next().value;
    } else {
        move = validMoves.values().next().value;
    }

    console.log('MOVE: ' + move)
    response.status(200).send({
        move: move,
    })
}

function handleEnd(request: GameRequest, response: Response) {
    const gameData = request.body

    console.log('END')
    response.status(200).send('ok')
}
