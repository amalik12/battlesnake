import bodyParser from 'body-parser'
import express, { Request, Response } from 'express'

import { SnakeInfo, Move, GameRequest, GameState, Coordinates, Snake } from './types'

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
    snakeMap: Map<string, Snake>;

    constructor(width: number, height: number, food: Coordinates[], snakes: Snake[]) {
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
        this.snakeMap = new Map();
        food.forEach(foodItem => this.writeData(foodItem, 'food'));
        snakes.forEach(snake => {
            this.snakeMap.set(snake.id, snake);
            snake.body.forEach(coord => this.writeData(coord, snake.id));
        });
    }

    isInBounds(coords: Coordinates) {
        return coords.x >= 0 && coords.x < this.width 
        && coords.y >= 0 && coords.y < this.height 
    }

    isUnoccupied(coords: Coordinates) {
        return this.getData(coords) === '' || this.getData(coords) === 'food';
    }

    isSnakeHead(coords: Coordinates) {
        const snake = this.snakeMap.get(this.getData(coords))
        return snake?.head.x === coords.x && snake.head.y === coords.y;
    }

    headToHead(id: string, length: number) {
        const snake = this.snakeMap.get(id)
        return snake !== undefined && snake.length < length;
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
    const board = new Board(gameData.board.width, gameData.board.height, gameData.board.food, gameData.board.snakes);
    
    const position = gameData.you.head;
    const directions: Direction[] = [Direction.up, Direction.down, Direction.right, Direction.left]
    const validMoves: Set<Direction> = new Set(directions);
    const optimalMoves: Set<Direction> = new Set(directions);

    directions.forEach(direction => {
        const delta = directionToCoords[direction];
        const newCoords = { x: position.x + delta.x, y: position.y + delta.y };
        if (!board.isInBounds(newCoords) || !board.isUnoccupied(newCoords)) {
            validMoves.delete(direction);
            optimalMoves.delete(direction);
        } else {
            let dist = 500;
            let food: Coordinates = { x: -1, y: -1 };
            gameData.board.food.forEach(coord => {
                if (distance(position, coord) < dist) {
                    dist = distance(position, coord);
                    food = coord;
                }
            })
            if ((gameData.you.health < 25 || dist <= 3) && distance(newCoords, food) > dist) {
                optimalMoves.delete(direction);
            }
            directions.every(adjacent => {
                const adjDelta = directionToCoords[adjacent];
                const adjCoords = { x: newCoords.x + adjDelta.x, y: newCoords.y + adjDelta.y };
                if (!board.isInBounds(adjCoords) || board.isUnoccupied(adjCoords)) {
                    return true;
                }
                const data = board.getData(adjCoords);
                if (data !== gameData.you.id) {
                    if (board.isSnakeHead(adjCoords) && !board.headToHead(data, gameData.you.length)) {
                        optimalMoves.delete(direction);
                        return false;
                    } else if (board.isSnakeHead(adjCoords)) {
                        optimalMoves.clear();
                        optimalMoves.add(direction);
                        return false;
                    }
                }
                return true;
            })
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
