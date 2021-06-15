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

function constructBoard(data: GameState) {
    let board: Board = new Board(data.board.width, data.board.height);
    data.board.food.forEach(food => board.writeData(food, 'food'));
    data.board.snakes.forEach(snake => {
        snake.body.forEach(coord => board.writeData(coord, snake.id));
    });
    return board;
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
    const possibleMoves: Direction[] = [Direction.up, Direction.down, Direction.left, Direction.right]
    const moves: Direction[] = [];

    possibleMoves.forEach(direction => {
        const delta = directionToCoords[direction];
        const newCoords = { x: position.x + delta.x, y: position.y + delta.y };
        if (board.isValid(newCoords)) {
            moves.push(direction);
        }
    })
    
    const move = moves[Math.floor(Math.random() * moves.length)]

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
