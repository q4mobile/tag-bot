import { 
  validateVersionString, 
  validateGitHubResponse, 
  validateGitHubContext, 
  validateCommentBody, 
  validateTagName,
  ValidationError 
} from '../validation';

describe('Validation Utilities', () => {
  describe('validateVersionString', () => {
    it('should validate correct version strings', () => {
      expect(() => validateVersionString('1.0.0')).not.toThrow();
      expect(() => validateVersionString('v1.0.0')).not.toThrow();
      expect(() => validateVersionString('0.1.0')).not.toThrow();
      expect(() => validateVersionString('10.20.30')).not.toThrow();
    });

    it('should reject invalid version strings', () => {
      expect(() => validateVersionString('')).toThrow(ValidationError);
      expect(() => validateVersionString('1.0')).toThrow(ValidationError);
      expect(() => validateVersionString('1.0.0.0')).toThrow(ValidationError);
      expect(() => validateVersionString('1.0.a')).toThrow(ValidationError);
      expect(() => validateVersionString('a.b.c')).toThrow(ValidationError);
      expect(() => validateVersionString('-1.0.0')).toThrow(ValidationError);
      expect(() => validateVersionString('1.0.-1')).toThrow(ValidationError);
    });

    it('should reject non-string inputs', () => {
      expect(() => validateVersionString(null as any)).toThrow(ValidationError);
      expect(() => validateVersionString(undefined as any)).toThrow(ValidationError);
      expect(() => validateVersionString(123 as any)).toThrow(ValidationError);
    });
  });

  describe('validateGitHubResponse', () => {
    it('should validate valid API responses', () => {
      expect(() => validateGitHubResponse({}, 'test')).not.toThrow();
      expect(() => validateGitHubResponse([], 'test')).not.toThrow();
      expect(() => validateGitHubResponse([{ id: 1 }], 'test')).not.toThrow();
    });

    it('should reject null/undefined responses', () => {
      expect(() => validateGitHubResponse(null, 'test')).toThrow(ValidationError);
      expect(() => validateGitHubResponse(undefined, 'test')).toThrow(ValidationError);
    });

    it('should reject non-object/array responses', () => {
      expect(() => validateGitHubResponse('string', 'test')).toThrow(ValidationError);
      expect(() => validateGitHubResponse(123, 'test')).toThrow(ValidationError);
      expect(() => validateGitHubResponse(true, 'test')).toThrow(ValidationError);
    });
  });

  describe('validateCommentBody', () => {
    it('should validate valid comment bodies', () => {
      expect(() => validateCommentBody('valid comment')).not.toThrow();
      expect(() => validateCommentBody('/tag-bot major')).not.toThrow();
      expect(() => validateCommentBody('  comment with spaces  ')).not.toThrow();
    });

    it('should reject invalid comment bodies', () => {
      expect(() => validateCommentBody('')).toThrow(ValidationError);
      expect(() => validateCommentBody('   ')).toThrow(ValidationError);
      expect(() => validateCommentBody(null as any)).toThrow(ValidationError);
      expect(() => validateCommentBody(undefined as any)).toThrow(ValidationError);
    });
  });

  describe('validateTagName', () => {
    it('should validate valid tag names', () => {
      expect(() => validateTagName('v1.0.0')).not.toThrow();
      expect(() => validateTagName('release-1.0')).not.toThrow();
      expect(() => validateTagName('feature-branch')).not.toThrow();
    });

    it('should reject invalid tag names', () => {
      expect(() => validateTagName('')).toThrow(ValidationError);
      expect(() => validateTagName('   ')).toThrow(ValidationError);
      expect(() => validateTagName('tag~name')).toThrow(ValidationError);
      expect(() => validateTagName('tag^name')).toThrow(ValidationError);
      expect(() => validateTagName('tag:name')).toThrow(ValidationError);
      expect(() => validateTagName('tag?name')).toThrow(ValidationError);
      expect(() => validateTagName('tag*name')).toThrow(ValidationError);
      expect(() => validateTagName('tag[name')).toThrow(ValidationError);
      expect(() => validateTagName('tag\\name')).toThrow(ValidationError);
    });

    it('should reject non-string inputs', () => {
      expect(() => validateTagName(null as any)).toThrow(ValidationError);
      expect(() => validateTagName(undefined as any)).toThrow(ValidationError);
      expect(() => validateTagName(123 as any)).toThrow(ValidationError);
    });
  });
});
