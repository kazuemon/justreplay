type Time = {
	hours: number;
	minutes: number;
	seconds: number;
	milliSeconds: number;
};

const divMod = (a: number, b: number): [number, number] => {
	const quotient = ~~(a / b);
	const remainder = a - quotient * b;
	return [quotient, remainder];
};

export const parseMs = (timeMs: number): Time => {
	if (timeMs === 0)
		return {
			hours: 0,
			minutes: 0,
			seconds: 0,
			milliSeconds: 0,
		};
	const [inSeconds, milliSeconds] = divMod(timeMs, 1000);
	const [inMinutes, seconds] = divMod(inSeconds, 60);
	const [inHours, minutes] = divMod(inMinutes, 60);
	return {
		hours: inHours,
		minutes,
		seconds,
		milliSeconds,
	};
};

export const parseMsTohhmmssSSS = (timeMs: number) => {
	return parseTimeTohhmmssSSS(parseMs(timeMs));
};

export const parseTimeTohhmmssSSS = (time: Time) => {
	const _ms = time.milliSeconds.toString().padStart(3, "0");
	const _seconds = time.seconds.toString().padStart(2, "0");
	const _minutes = time.minutes.toString().padStart(2, "0");
	return `${time.hours}:${_minutes}:${_seconds}.${_ms}`;
};
