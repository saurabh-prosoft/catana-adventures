import { Animations, GameObjects, Math as M, Types } from 'phaser';
import { Game } from '../scenes/game';
import { chance, choose, clampLow, normalize, rand } from '../utils';
import { Fireball } from './fireball';
import { DeterministicRandomPath } from '../utils/drp';
import { AnimatedLight } from '../helpers/animated-light';
import { Monster, MonsterFlags } from './monster';

export type SkeletonAnimationType =
  | 'idle'
  | 'move'
  | 'attack'
  | 'hurt'
  | 'die'
  | 'transform-in'
  | 'transform-out'
  | 'skull';
export interface SkeletonConfig {
  speed: number;
  attackPower: () => number;
  chaseDistance: number;
  attackDistance: number;
  maxHealth: number;
  dynamicDormancyDuration: number;
  dormancyCooldown: number;
  dormancyProbability: number;
  etherealFormThreshold: number;
  etherealFormProbability: number;
  lastDormantAt: number;
  dormancyStartedAt: number;
  minDormancyDuration: number;
  maxDormancyDuration: number;
  lightColor: number;
  lightRadius: number;
  lightIntensity: number;
}
export type SkeletonState = 'roam' | 'chase' | 'attack' | 'fly';
export interface SkeletonFlags extends MonsterFlags {
  isDormant: boolean;
  isTransforming: 'in' | 'out' | false;
}

export class Skeleton extends Monster<SkeletonConfig, SkeletonState, SkeletonFlags, SkeletonAnimationType> {
  declare controller: {
    sensors: {
      left: MatterJS.BodyType;
      right: MatterJS.BodyType;
      bottomLeft: MatterJS.BodyType;
      bottomRight: MatterJS.BodyType;
    };
    numOfTouchingSurfaces: {
      left: number;
      right: number;
      bottomLeft: number;
      bottomRight: number;
    };
    blocked: {
      left: boolean;
      right: boolean;
      bottomLeft: boolean;
      bottomRight: boolean;
    };
  };
  path: DeterministicRandomPath;
  pathOrigin: { x: number; y: number };
  pathTS: number;
  inPos: { x: number; y: number };
  outPos: { x: number; y: number };
  prevPathX: number;
  light: AnimatedLight;

  constructor(game: Game, pos: Types.Math.Vector2Like) {
    super(
      game,
      'skeleton',
      pos,
      'roam',
      {
        speed: 1,
        attackPower: () => rand(6, 12),
        chaseDistance: 200,
        attackDistance: 45,
        maxHealth: 30,
        dynamicDormancyDuration: rand(3000, 7000),
        minDormancyDuration: 3000,
        maxDormancyDuration: 7000,
        dormancyCooldown: rand(3000, 5000),
        dormancyProbability: rand(0.35, 0.55),
        etherealFormThreshold: 0.25,
        etherealFormProbability: /* rand(0.2, 0.3) */ 1,
        lastDormantAt: -1,
        dormancyStartedAt: -1,
        lightColor: 0xee4b2b,
        lightRadius: 65,
        lightIntensity: 0.9,
      },
      'idle',
    );

    this.setLight();
  }

  private setLight() {
    this.light = new AnimatedLight(
      this.game,
      this.game.lights.addLight(this.sprite.x, this.sprite.y, this.config.lightRadius, this.config.lightColor, 0),
      { radius: this.config.lightRadius, intensity: this.config.lightIntensity },
    );
  }
  setPhysics() {
    const w = this.sprite.width;
    const h = this.sprite.height;
    this.controller = {
      sensors: {
        left: this.game.matter.bodies.rectangle(w * 0.25, w / 2, 5, 10, { isSensor: true }),
        right: this.game.matter.bodies.rectangle(w * 0.75, w / 2, 5, 10, { isSensor: true }),
        bottomLeft: this.game.matter.bodies.rectangle(w * 0.25, w - 2.5, 10, 5, { isSensor: true }),
        bottomRight: this.game.matter.bodies.rectangle(w * 0.75, w - 2.5, 10, 5, { isSensor: true }),
      },
      numOfTouchingSurfaces: { left: 0, right: 0, bottomLeft: 0, bottomRight: 0 },
      blocked: { left: false, right: false, bottomLeft: false, bottomRight: false },
    };

    this.body = this.game.matter.bodies.rectangle(w / 2, w / 2 + 7, w / 3, h / 1.5);
    (this.body as any).props = { destroyable: true };

    const compoundBody = this.game.matter.body.create({
      parts: [
        this.body,
        this.controller.sensors.left,
        this.controller.sensors.right,
        this.controller.sensors.bottomLeft,
        this.controller.sensors.bottomRight,
      ],
      restitution: 0.05,
    });

    this.sprite.setExistingBody(compoundBody).setPosition(this.spawnPos.x, this.spawnPos.y).setFixedRotation();
  }
  setAnimations() {
    const idle = this.sprite.anims.create({
      key: 'idle',
      frames: this.sprite.anims.generateFrameNumbers('skeleton', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1,
    });
    const move = this.sprite.anims.create({
      key: 'move',
      frames: this.sprite.anims.generateFrameNumbers('skeleton', { start: 8, end: 11 }),
      frameRate: 8,
      repeat: -1,
    });
    const attack = this.sprite.anims.create({
      key: 'attack',
      frames: this.sprite.anims.generateFrameNumbers('skeleton', { start: 16, end: 19 }),
      frameRate: 17,
      repeat: 0,
    });
    const hurt = this.sprite.anims.create({
      key: 'hurt',
      frames: this.sprite.anims.generateFrameNumbers('skeleton', { start: 24, end: 26 }),
      frameRate: 8,
      repeat: 0,
    });
    const die = this.sprite.anims.create({
      key: 'die',
      frames: this.sprite.anims.generateFrameNumbers('skeleton', { start: 24, end: 30 }),
      frameRate: 15,
      repeat: 0,
    });
    const transformIn = this.sprite.anims.create({
      key: 'transform-in',
      frames: this.sprite.anims.generateFrameNumbers('skeleton', { start: 32, end: 37 }),
      frameRate: 14,
      repeat: 0,
    });
    const transformOut = this.sprite.anims.create({
      key: 'transform-out',
      frames: this.sprite.anims.generateFrameNumbers('skeleton', {
        frames: [37, 36, 35, 34, 33, 32],
      }),
      frameRate: 14,
      repeat: 0,
    });
    const skull = this.sprite.anims.create({
      key: 'skull',
      frames: this.sprite.anims.generateFrameNumbers('skeleton', {
        start: 37,
        end: 38,
      }),
      frameRate: 16,
      repeat: -1,
    });

    this.animations = {
      idle,
      move,
      attack,
      hurt,
      die,
      'transform-in': transformIn,
      'transform-out': transformOut,
      skull,
    };
  }

  beforeUpdate(_delta: number, time: number) {
    if (this.flags.isDead && !this.flags.isDisposed && this.state === 'fly' && this.outPos && this.sprite) {
      this.sprite.setPosition(this.outPos.x, this.outPos.y - this.sprite.height / 1.5);
    }
    if (this.flags.isHurting || this.flags.isDead) return;

    this.light.source.x = this.sprite.x;
    this.light.source.y = this.sprite.y;
    const distanceToPlayer = M.Distance.Between(this.sprite.x, this.sprite.y, this.game.player.x, this.game.player.y);

    if (this.state !== 'fly' && !this.flags.isTransforming) {
      if (distanceToPlayer <= this.config.chaseDistance && !this.game.player.flags.isDead) {
        this.state = 'chase';
        if (this.flags.isDormant) {
          this.flags.isDormant = false;
          this.config.lastDormantAt = time;
        }
      } else {
        this.state = 'roam';
      }

      this.applyInputs(time);
    } else if (!this.flags.isTransforming) {
      if (distanceToPlayer > 750) {
        this.transform('out');
      } else {
        this.fly(time);
      }
    } else if (this.flags.isTransforming === 'out') {
      this.sprite.setPosition(this.inPos.x, this.inPos.y - this.sprite.height / 1.5);
    }

    this.controller.numOfTouchingSurfaces.left = 0;
    this.controller.numOfTouchingSurfaces.right = 0;
    this.controller.numOfTouchingSurfaces.bottomLeft = 0;
    this.controller.numOfTouchingSurfaces.bottomRight = 0;
  }
  collisionActive(event: { pairs: Types.Physics.Matter.MatterCollisionPair[]; timestamp: number }) {
    if (this.flags.isHurting || this.flags.isDead) return;

    const left = this.controller.sensors.left;
    const right = this.controller.sensors.right;
    const bottomLeft = this.controller.sensors.bottomLeft;
    const bottomRight = this.controller.sensors.bottomRight;
    const player = this.game.player.controller.sprite;

    for (let i = 0; i < event.pairs.length; i += 1) {
      const [bodyA, bodyB] = [event.pairs[i].bodyA, event.pairs[i].bodyB];

      if (bodyA === this.body || bodyB === this.body) {
        if (bodyA.gameObject === player || bodyB.gameObject === player) {
          this.attack();
        } else if (bodyA.gameObject?.name?.includes('fireball') || bodyB.gameObject?.name?.includes('fireball')) {
          const fireballGO = (
            bodyA.gameObject?.name?.includes('fireball') ? bodyA.gameObject : bodyB.gameObject
          ) as GameObjects.GameObject;
          this.hit(event.timestamp, this.game.objects.fireballs[fireballGO.name]);
        }
        continue;
      } else if (bodyA === bottomLeft || bodyB === bottomLeft) {
        this.controller.numOfTouchingSurfaces.bottomLeft += 1;
      } else if (bodyA === bottomRight || bodyB === bottomRight) {
        this.controller.numOfTouchingSurfaces.bottomRight += 1;
      } else if (
        (bodyA === left && (bodyB.isStatic || bodyB.gameObject)) ||
        (bodyB === left && (bodyA.isStatic || bodyA.gameObject))
      ) {
        this.controller.numOfTouchingSurfaces.left += 1;
      } else if (
        (bodyA === right && (bodyB.isStatic || bodyB.gameObject)) ||
        (bodyB === right && (bodyA.isStatic || bodyA.gameObject))
      ) {
        this.controller.numOfTouchingSurfaces.right += 1;
      }
    }
  }
  afterUpdate(_delta: number, _time: number) {
    if (this.flags.isHurting || this.flags.isDead) return;

    this.controller.blocked.right = this.controller.numOfTouchingSurfaces.right > 0 ? true : false;
    this.controller.blocked.left = this.controller.numOfTouchingSurfaces.left > 0 ? true : false;
    this.controller.blocked.bottomLeft = this.controller.numOfTouchingSurfaces.bottomLeft > 0 ? true : false;
    this.controller.blocked.bottomRight = this.controller.numOfTouchingSurfaces.bottomRight > 0 ? true : false;
  }

  private applyInputs(time: number) {
    // If chasing or attacking, always face the player
    if (this.state === 'chase' || this.state === 'attack') {
      this.direction = Math.sign(this.game.player.x - this.sprite.x);
    }

    if (this.flags.isDormant && time - this.config.dormancyStartedAt > this.config.dynamicDormancyDuration) {
      this.flags.isDormant = false;
      this.config.lastDormantAt = time;
      this.direction = choose([-1, 1]);
    }

    // If roaming or chasing, move around
    if ((this.state === 'roam' || this.state === 'chase') && !this.flags.isDormant) {
      if (
        this.state === 'roam' &&
        time - this.config.lastDormantAt > this.config.dormancyCooldown &&
        chance(this.config.dormancyProbability)
      ) {
        this.flags.isDormant = true;
        this.config.dormancyStartedAt = time;
        this.config.dynamicDormancyDuration = rand(this.config.minDormancyDuration, this.config.maxDormancyDuration);
        this.sprite.anims.play('idle', true);
        return;
      }

      let canMove = this.controller.blocked.bottomRight || this.controller.blocked.bottomLeft;
      if (
        ((this.direction === 1 && !this.controller.blocked.bottomRight) ||
          (this.direction === -1 && !this.controller.blocked.bottomLeft) ||
          (this.direction === -1 && this.controller.blocked.left) ||
          (this.direction === 1 && this.controller.blocked.right)) &&
        canMove &&
        this.state !== 'chase'
      ) {
        this.direction = this.direction * -1;
      }
      if (canMove) {
        this.move();
      }
    }
  }
  private move() {
    if (
      this.state === 'chase' &&
      ((this.direction === 1 && !this.controller.blocked.bottomRight) ||
        (this.direction === -1 && !this.controller.blocked.bottomLeft))
    ) {
      this.sprite.anims.play('idle', true);
    } else {
      this.sprite.anims.play('move', true);
      this.sprite.setVelocity(this.direction * this.config.speed, 0);
    }
  }
  private attack() {
    if (this.state === 'attack') return;
    else if (this.state === 'fly') {
      this.game.player.hit(this.config.attackPower(), this.direction, this.sprite.name);
    } else {
      this.state = 'attack';
      this.sprite.anims.play('attack', true).once(Animations.Events.ANIMATION_COMPLETE, () => (this.state = 'roam'));
      this.game.player.hit(this.config.attackPower(), this.direction, this.sprite.name);
    }
  }
  private fly(time: number) {
    if (this.flags.isDead) return;
    if (this.game.player.flags.isDead) {
      this.transform('out', time);
      return;
    }

    this.prevPathX = this.sprite.x;
    const newPos = this.path.next(time - this.pathTS);
    this.sprite.x = this.pathOrigin.x + newPos.x;
    this.sprite.y = this.pathOrigin.y + newPos.y;
    this.direction = Math.sign(this.sprite.x - this.prevPathX);

    this.pathOrigin.x += Math.sign(this.game.player.x - this.pathOrigin.x) * 0.75;
    this.pathOrigin.y += Math.sign(this.game.player.y - this.pathOrigin.y) * 0.75;
  }
  private transform(dir: 'in' | 'out', time?: number) {
    this.flags.isTransforming = dir;
    if (dir === 'in') {
      this.inPos = { x: this.sprite.x, y: this.sprite.y };
      this.game.objects.skulls[this.id] = this;
    } else {
      this.outPos = { x: this.sprite.x, y: this.sprite.y };
      delete this.game.objects.skulls[this.id];
    }
    this.sprite.anims.play(`transform-${dir}`).once(Animations.Events.ANIMATION_COMPLETE, () => {
      if ((this.flags.isTransforming as any) === 'in') {
        this.state = 'fly';
        this.game.lightsOff();
        this.light.on();
        this.body.isSensor = true;
        this.pathOrigin = { x: this.sprite.x, y: this.sprite.y };
        this.path = new DeterministicRandomPath({ x: this.sprite.x, y: this.sprite.y }, 150, 150, 150);
        this.pathTS = time ?? 0;
      } else {
        this.state = 'roam';
        this.game.lightsOn();
        this.light.off();
        this.body.isSensor = false;
      }
      this.sprite.anims.play(dir === 'in' ? 'skull' : 'idle');
      this.flags.isTransforming = false;
    });
  }
  hit(time: number, fireball?: Fireball) {
    if (!fireball) return;

    this.stats[fireball.type === 'high' ? 'noOfPowerAttacks' : 'noOfFastAttacks'] += 1;
    this.direction = fireball.direction * -1;

    this.health = clampLow(this.health - fireball.config.power, 0);
    if (this.health === 0) {
      this.die();
    } else {
      this.hurt();
      if (
        normalize(this.health, 0, this.config.maxHealth) <= this.config.etherealFormThreshold &&
        chance(this.config.etherealFormProbability)
      ) {
        this.transform('in', time);
      }
    }
  }
  die() {
    if (this.flags.isDead) return;

    if (!this.game.lightState) {
      delete this.game.objects.skulls[this.id];
      this.outPos = { x: this.sprite.x, y: this.sprite.y };
      this.game.lightsOn();
      this.light.off();
    }
    this.flags.isDead = true;
    this.game.lights.removeLight(this.light.source);
    (this.sprite.body as MatterJS.BodyType).isSensor = true;
    this.sprite.anims.play('die').once(Animations.Events.ANIMATION_COMPLETE, () => this.dispose());
  }
  hurt() {
    this.flags.isHurting = true;
    this.sprite.setVelocity(this.direction * -1 * 2, -3);
    this.sprite.anims.play('hurt').once(Animations.Events.ANIMATION_COMPLETE, () => {
      this.flags.isHurting = false;
      this.sprite.anims.play('idle');
    });
  }
}
