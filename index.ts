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

enum Diagonal {
    northwest = 'northwest',
    northeast = 'northeast',
    southwest = 'southwest',
    southeast = 'southeast'
}

type AdjacentDirection = Direction | Diagonal;

const DIRECTIONS: Direction[] = [Direction.up, Direction.down, Direction.right, Direction.left]
const ADJACENT_DIRECTIONS: AdjacentDirection[] = [Direction.up, Direction.down, Direction.right, Direction.left,
    Diagonal.northeast, Diagonal.northwest, Diagonal.southeast, Diagonal.southwest];

interface SnakeState {
    lastDirection: Direction

    hasEaten: boolean

    lastBoard?: Board
}

const stateMap: Map<string, SnakeState> = new Map();

class Board {
    private width: number;
    private height: number;
    private grid: string[][];
    private snakeMap: Map<string, Snake>;
    private id: string;

    constructor(width: number, height: number, food: Coordinates[], snakes: Snake[], id: string) {
        this.width = width;
        this.height = height;
        this.grid = [];
        this.id = id;
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

    isOnEdge(coords: Coordinates) {
        return coords.y === 0 || coords.y === this.height - 1 
        || coords.x === 0 || coords.x === this.width - 1;
    }

    isBodyBlocked(coords: Coordinates) {
        const reverseDirection = {
            [Direction.up]: Direction.down,
            [Direction.down]: Direction.up,
            [Direction.left]: Direction.right,
            [Direction.right]: Direction.left,
            [Diagonal.northeast]: Diagonal.southwest,
            [Diagonal.southwest]: Diagonal.northeast,
            [Diagonal.northwest]: Diagonal.southeast,
            [Diagonal.southeast]: Diagonal.northwest
        }
        for (let index = 0; index < ADJACENT_DIRECTIONS.length; index++) {
            if (reverseDirection[ADJACENT_DIRECTIONS[index]] === stateMap.get(this.id)?.lastDirection) {
                continue;   
            }
            const adjCoords: Coordinates = getAdjacentCoords(coords, ADJACENT_DIRECTIONS[index]);
            if (this.isInBounds(adjCoords) && !this.isUnoccupied(adjCoords)) {
                return true;
            }
        }
        return false;
    }

    getSnakeDirection(id: string) {
        const snake = this.snakeMap.get(id);
        if (snake !== undefined) return getDirection(snake?.body[1], snake?.body[0])
    }

    isSnakeHead(coords: Coordinates) {
        const snake = this.snakeMap.get(this.getData(coords))
        return snake !== undefined && areCoordsEqual(snake.head, coords);
    }

    isValidSnakeTail(lastBoard: Board | undefined, coords: Coordinates) {
        const snake = this.snakeMap.get(this.getData(coords))
        if (snake === undefined) return false;
        return lastBoard?.getData(snake.head) !== 'food' && areCoordsEqual(snake.body[snake.body.length - 1], coords);
    }
    
    isReachable(start: Coordinates, end: Coordinates, lastBoard: Board | undefined) {
        const visited = new Set();
        const stack: Coordinates[] = [start];
        let found = false;
        while (stack.length > 0) {
            const node = stack.pop();
            if (node === undefined) break;

            if (areCoordsEqual(node, end)) {
                found = true;
            }
            if (visited.has(node.x + ',' + node.y) || !this.isInBounds(node) || (!this.isUnoccupied(node) && !this.isValidSnakeTail(lastBoard, node))) {
                continue;
            }
            visited.add(node.x + ',' + node.y);
            for (let i = 0; i < DIRECTIONS.length; i++) {
                stack.push(getAdjacentCoords(node, DIRECTIONS[i]));
            }
        }
        let result = visited.size;
        if (!found) result *= -1;
        return result;
    }

    headToHead(id: string, length: number) {
        const snake = this.snakeMap.get(id)
        if (snake === undefined) return 0;
        if (snake.length < length) return 1;
        if (snake.length === length) return 0;
        return -1;
    }


    getData(coords: Coordinates) {
        return this.grid[this.height - 1 - coords.y][coords.x];
    }

    writeData(coords: Coordinates, data: string) {
        this.grid[this.height - 1 - coords.y][coords.x] = data;
    }
}

function distance(start: Coordinates, end: Coordinates) {
    return Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
}

function areCoordsEqual(coords1: Coordinates, coords2: Coordinates) {
    return coords1.x === coords2.x && coords1.y === coords2.y
}

function getAdjacentCoords(position: Coordinates, direction: AdjacentDirection) {
    const directionToCoords = {
        [Direction.up]: { x: 0, y: 1 },
        [Direction.down]: { x: 0, y: -1 },
        [Direction.left]: { x: -1, y: 0 },
        [Direction.right]: { x: 1, y: 0 },
        [Diagonal.northeast]: { x: 1, y: 1},
        [Diagonal.northwest]: { x: -1, y: 1 },
        [Diagonal.southeast]: { x: 1, y: -1 },
        [Diagonal.southwest]: { x: -1, y: -1 }
    }
    const delta = directionToCoords[direction];
    return { x: position.x + delta.x, y: position.y + delta.y };
}

function getDirection(start: Coordinates, end: Coordinates) {
    const coordsToDirection: any = {
        '0,1': Direction.up,
        '0,-1': Direction.down,
        '-1,0': Direction.left,
        '1,0': Direction.right
    }
    const dirString = (end.x - start.x) + ',' + (end.y - start.y);
    return coordsToDirection[dirString];
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
    const gameData: GameState = request.body;

    stateMap.set(gameData.game.id, { lastDirection: Direction.up, hasEaten: false });

    console.log('START')
    response.status(200).send('ok')
}

function handleMove(request: GameRequest, response: Response<Move>) {
    const gameData: GameState = request.body
    const board = new Board(gameData.board.width, gameData.board.height, gameData.board.food, gameData.board.snakes, gameData.game.id);
    
    const position = gameData.you.head;
    
    const scores = {
        [Direction.up]: 0,
        [Direction.down]: 0,
        [Direction.left]: 0,
        [Direction.right]: 0
    }

    let move: Direction = Direction.up;
    let maxScore = -50;
    const state = stateMap.get(gameData.game.id);

    DIRECTIONS.forEach(direction => {
        const newCoords: Coordinates = getAdjacentCoords(position, direction);
        if (!board.isInBounds(newCoords) || (!board.isUnoccupied(newCoords) && !board.isValidSnakeTail(state?.lastBoard, newCoords))) {
            scores[direction] -= 40;           
        } else {
            let dist = 500;
            let food: Coordinates = { x: -1, y: -1 };
            gameData.board.food.forEach(coord => {
                if (distance(position, coord) < dist) {
                    dist = distance(position, coord);
                    food = coord;
                }
            })
            if ((gameData.you.health < 25 || dist <= 6) && distance(newCoords, food) < dist) {
                scores[direction] += 1;
            }
            DIRECTIONS.every(adjacent => {
                const adjCoords: Coordinates = getAdjacentCoords(newCoords, adjacent);
                if (!board.isInBounds(adjCoords) || board.isUnoccupied(adjCoords)) {
                    return true;
                }
                const data = board.getData(adjCoords);
                if (data !== gameData.you.id) {
                    if (board.isSnakeHead(adjCoords) && board.headToHead(data, gameData.you.length) <= 0) {
                        scores[direction] -= 12;
                        if (getDirection(adjCoords, newCoords) === board.getSnakeDirection(data)) {
                            scores[direction] -= 2;
                        }
                        if (board.headToHead(data, gameData.you.length) === -1) {
                            scores[direction] -= 1;
                        }
                        return false;
                    } else if (board.isSnakeHead(adjCoords)) {
                        scores[direction] += 10;
                        return false;
                    }
                }
                return true;
            })
            if (board.isOnEdge(position) || board.isBodyBlocked(position)) {
                console.log('searching');
                const tail = gameData.you.body[gameData.you.body.length - 1];
                const searchResult = board.isReachable(newCoords, tail, state?.lastBoard) || 0;
                if (searchResult < 0) {
                    scores[direction] -= 6;
                }
                scores[direction] += Math.abs(searchResult) * 0.1;
                console.log('done', direction, searchResult);
            }
        }
        if (scores[direction] > maxScore) {
            maxScore = scores[direction];
            move = direction;
        }
    })

    console.log('Game:', gameData.game.id, 'Turn:', gameData.turn, 'Scores:', scores, 'Move:', move)
    
    if (state !== undefined) {
        state.lastDirection = move;
        const newCoords: Coordinates = getAdjacentCoords(position, move);
        state.hasEaten = board.isInBounds(newCoords) && board.getData(newCoords) === 'food';
        state.lastBoard = board;
    }
    response.status(200).send({
        move: move,
    })
}

function handleEnd(request: GameRequest, response: Response) {
    const gameData: GameState = request.body

    stateMap.delete(gameData.game.id);
    console.log('END')
    response.status(200).send('ok')
}
